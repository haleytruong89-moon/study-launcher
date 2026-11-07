import { describe, expect, it } from "vitest";
import { WORLDS, WORLD_ORDER, findThing } from "@/lib/world/catalog";
import { defaultWorld, isMonth, monthView, monthsBetween, pick, plantsToAdd, prevMonth, type WorldRow } from "@/lib/world/rules";
import { RUNG } from "@/lib/world/rung";
import { PILLARS, type Pillar } from "@/lib/world/types";

const KEY = /^[a-z][a-z0-9_]{1,47}$/;

describe("world packs (content rules)", () => {
  for (const world of Object.values(WORLDS)) {
    it(`${world.key}: 6 things per area, 8 animals, unique stable keys, 3 facts each`, () => {
      expect(WORLD_ORDER).toContain(world.key);
      const keys = [...PILLARS.flatMap((p) => world.things[p].map((t) => t.key)), ...world.animals.map((a) => a.key)];
      expect(new Set(keys).size).toBe(keys.length);
      for (const k of keys) expect(k).toMatch(KEY);
      for (const p of PILLARS) expect(world.things[p]).toHaveLength(6);
      expect(world.animals).toHaveLength(8);
      for (const item of [...PILLARS.flatMap((p) => world.things[p]), ...world.animals]) {
        expect(item.facts).toHaveLength(3);
        for (const f of item.facts) expect(f.trim().length).toBeGreaterThan(10);
        expect(item.mission.trim()).not.toBe("");
        expect(item.teach.trim()).not.toBe("");
        expect("emoji" in item.icon || "svg" in item.icon).toBe(true);
      }
    });
    it(`${world.key}: every animal can come (its tags exist in enough things)`, () => {
      const things = PILLARS.flatMap((p) => world.things[p]);
      for (const a of world.animals) {
        for (const n of a.needs) expect(things.filter((t) => t.tags.includes(n.tag)).length, `${a.key} needs ${n.tag}`).toBeGreaterThanOrEqual(n.n);
      }
    });
  }
});

describe("what grows (cách 2)", () => {
  it("the first 6 plants of an area are 6 new things; the 7th grows the first again", () => {
    const got = Array.from({ length: 8 }, (_, k) => pick(RUNG, "study", k));
    expect(got.slice(0, 6).map((g) => g.itemKey)).toEqual(RUNG.things.study.map((t) => t.key));
    expect(got.slice(0, 6).every((g) => g.variant === 0)).toBe(true);
    expect(got[6]).toEqual({ itemKey: RUNG.things.study[0]?.key, variant: 1 });
    expect(got[7]).toEqual({ itemKey: RUNG.things.study[1]?.key, variant: 1 });
  });

  it("adds only finished areas without a plant, day by day, continuing the count", () => {
    const existing: WorldRow[] = [{ local_date: "2026-11-03", pillar: "study", world_key: "rung", item_key: "cho_ngan_nam", variant: 0 }];
    const done: { date: string; pillar: Pillar }[] = [
      { date: "2026-11-05", pillar: "play" },
      { date: "2026-11-03", pillar: "study" }, // already planted
      { date: "2026-11-04", pillar: "study" },
      { date: "2026-11-05", pillar: "feel" },
      { date: "2026-11-05", pillar: "feel" }, // two visits on a day: one flower
      { date: "2026-11-05", pillar: "study" },
    ];
    expect(plantsToAdd(done, existing, "rung")).toEqual([
      { local_date: "2026-11-04", pillar: "study", world_key: "rung", item_key: "cay_da", variant: 0 },
      { local_date: "2026-11-05", pillar: "feel", world_key: "rung", item_key: "lan_hai", variant: 0 },
      { local_date: "2026-11-05", pillar: "study", world_key: "rung", item_key: "tre", variant: 0 },
      { local_date: "2026-11-05", pillar: "play", world_key: "rung", item_key: "nam", variant: 0 },
    ]);
    expect(plantsToAdd(done, existing, "no_such_world")).toEqual([]);
  });
});

describe("what the child sees", () => {
  const row = (d: string, pillar: Pillar, item: string, variant = 0): WorldRow => ({ local_date: `2026-11-${d}`, pillar, world_key: "rung", item_key: item, variant });

  it("a thing opens one fact per time it grew (max 3); only opened facts leave the server", () => {
    const v = monthView("2026-11", "rung", [row("01", "study", "cho_ngan_nam"), row("08", "study", "cho_ngan_nam", 1)], "2026-11-08");
    const cho = v?.things.find((t) => t.key === "cho_ngan_nam");
    expect(cho).toMatchObject({ count: 2, firstDate: "01/11", closed: 1, today: true, pillar: "study" });
    expect(cho?.facts).toEqual(findThing(RUNG, "cho_ngan_nam")?.thing.facts.slice(0, 2));
    expect(v?.waiting).toBe(23);
    expect(v?.plants).toBe(2);
  });

  it("animals come when the world has what they need, and stay", () => {
    const v = monthView("2026-11", "rung", [row("01", "feel", "lan_hai"), row("02", "feel", "hoa_ban"), row("03", "feel", "hoa_sim"), row("04", "study", "cay_da"), row("05", "study", "tre")], "2026-11-09");
    const names = v?.animals.map((a) => [a.key, a.arrived]);
    expect(names).toEqual([
      ["ong_mat", "02/11"],
      ["buom", "03/11"],
      ["tac_ke", "05/11"],
    ]);
    expect(v?.animals.every((a) => a.facts.length === 3 && !a.today)).toBe(true);
  });

  it("rows of another month, another world or unknown keys never break the page", () => {
    const v = monthView("2026-11", "rung", [row("01", "feel", "gone_key"), { ...row("02", "feel", "lan_hai"), world_key: "bien" }, { ...row("03", "feel", "hoa_ban"), local_date: "2026-10-31" }], "2026-11-09");
    expect(v?.things).toEqual([]);
    expect(monthView("2026-11", "no_such_world", [], "2026-11-09")).toBeNull();
  });
});

describe("months and the world of a month", () => {
  it("counts months across a year", () => {
    expect(prevMonth("2027-01")).toBe("2026-12");
    expect(prevMonth("2026-11")).toBe("2026-10");
    expect(monthsBetween("2026-11", "2027-10")).toBe(11);
    expect(isMonth("2026-11")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("2026-11-01")).toBe(false);
  });
  it("defaults to the first world not used in the last 11 months; else the one used longest ago", () => {
    expect(defaultWorld("2026-11", [])).toBe("rung");
    // Only Rừng has a pack so far: it comes back rather than leaving a month empty.
    expect(defaultWorld("2026-12", [{ month: "2026-11", worldKey: "rung" }])).toBe("rung");
  });
});
