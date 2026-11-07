import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WORLDS, WORLD_ORDER, findThing } from "@/lib/world/catalog";
import { defaultWorld, isMonth, worldOfMonth, worldOptions, monthView, monthsBetween, pick, plantsToAdd, prevMonth, type WorldRow } from "@/lib/world/rules";
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

describe("the reading copy for parents and An", () => {
  for (const world of Object.values(WORLDS)) {
    it(`docs/world/${world.key.toUpperCase()}.md has every name, fact, mission and teach line of the ${world.key} pack`, () => {
      const md = readFileSync(`docs/world/${world.key.toUpperCase()}.md`, "utf8");
      const items = [...PILLARS.flatMap((p) => world.things[p]), ...world.animals];
      for (const s of [world.intro, ...items.flatMap((t) => [t.name, ...t.facts, t.mission, t.teach])]) expect(md, s).toContain(s);
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
  it("defaults to the first world with a pack not used in the last 11 months; none left → the month waits", () => {
    expect(defaultWorld("2026-11", [])).toBe("rung");
    expect(defaultWorld("2026-12", [{ month: "2026-11", worldKey: "rung" }])).toBe("bien");
    expect(defaultWorld("2027-02", [
      { month: "2026-11", worldKey: "rung" },
      { month: "2026-12", worldKey: "bien" },
      { month: "2027-01", worldKey: "vu_tru" },
    ])).toBe("nui_lua");
    // Every pack used in the last 11 months: the month waits for a new world instead of repeating one.
    expect(defaultWorld("2027-03", [
      { month: "2026-11", worldKey: "rung" },
      { month: "2026-12", worldKey: "bien" },
      { month: "2027-01", worldKey: "vu_tru" },
      { month: "2027-02", worldKey: "nui_lua" },
    ])).toBeNull();
    // 12 months later Rừng is new again.
    expect(defaultWorld("2027-11", [{ month: "2026-11", worldKey: "rung" }])).toBe("rung");
  });
});

describe("An picks the world of the month (R4b)", () => {
  const known = (planted: [string, string][], picked: [string, string][] = []) => ({ planted: new Map(planted), picked: new Map(picked) });
  it("this month, no plants, no pick, several worlds: wait for An (nothing is planted yet)", () => {
    expect(worldOfMonth("2026-12", true, known([["2026-11", "rung"]]))).toEqual({ key: null, choose: ["bien", "vu_tru"] });
  });
  it("a pick or the month's plants fix the world", () => {
    expect(worldOfMonth("2026-12", true, known([["2026-11", "rung"]], [["2026-12", "vu_tru"]]))).toEqual({ key: "vu_tru", choose: [] });
    expect(worldOfMonth("2026-12", true, known([["2026-12", "bien"]], [["2026-12", "vu_tru"]]))).toEqual({ key: "bien", choose: [] });
  });
  it("a month that ended without a pick takes the default; one world left is no choice", () => {
    expect(worldOfMonth("2026-12", false, known([["2026-11", "rung"]]))).toEqual({ key: "bien", choose: [] });
    expect(worldOfMonth("2027-02", true, known([["2026-11", "rung"], ["2026-12", "bien"], ["2027-01", "vu_tru"]]))).toEqual({ key: "nui_lua", choose: [] });
  });
  it("an ended month never takes the world already picked for the next month (pick made after midnight)", () => {
    expect(worldOfMonth("2026-12", false, known([["2026-11", "rung"]], [["2027-01", "bien"]]))).toEqual({ key: "vu_tru", choose: [] });
    expect(worldOfMonth("2026-12", false, known([["2026-11", "rung"]], [["2027-01", "vu_tru"]]))).toEqual({ key: "bien", choose: [] });
  });
  it("offers only worlds with a pack not used in the 11 months before", () => {
    // Núi lửa is the January 2027 pack: not on offer before.
    expect(worldOptions("2026-11", [])).toEqual(["rung", "bien", "vu_tru"]);
    expect(worldOptions("2027-01", [{ month: "2026-11", worldKey: "rung" }, { month: "2026-12", worldKey: "bien" }])).toEqual(["vu_tru", "nui_lua"]);
    expect(worldOptions("2027-11", [{ month: "2026-11", worldKey: "rung" }])).toEqual(["rung", "bien", "vu_tru", "nui_lua"]);
    expect(worldOptions("2027-10", [{ month: "2026-11", worldKey: "rung" }])).toEqual(["bien", "vu_tru", "nui_lua"]);
  });
});
