import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WORLDS, WORLD_ORDER, findThing } from "@/lib/world/catalog";
import { MAX_FACTS, defaultWorld, feelGrowthOf, isMonth, moveOf, recentDayLabel, recentGrowth, worldOfMonth, worldOptions, monthView, monthsBetween, pick, plantsToAdd, prevMonth, type WorldRow } from "@/lib/world/rules";
import { BIEN } from "@/lib/world/bien";
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

describe("feelGrowthOf (R6a: the reward on Góc bình yên's \"Xong rồi\")", () => {
  const row = (d: string, pillar: Pillar, item: string, variant = 0): WorldRow => ({ local_date: `2026-11-${d}`, pillar, world_key: "rung", item_key: item, variant });
  const lan = RUNG.things.feel[0]!;
  const facts = lan.facts;
  it("a new flower today: its name, the 1st fact, isNew", () => {
    const g = feelGrowthOf(monthView("2026-11", "rung", [row("08", "feel", "lan_hai")], "2026-11-08")!);
    expect(g).toEqual({ kind: "grew", name: "Lan hài", icon: lan.icon, world: "Rừng nhiệt đới", isNew: true, fact: facts[0], animal: null, again: false });
  });
  it("the same flower again: grows, opens the next fact", () => {
    const g = feelGrowthOf(monthView("2026-11", "rung", [row("01", "feel", "lan_hai"), row("08", "feel", "lan_hai", 1)], "2026-11-08")!);
    expect(g).toMatchObject({ kind: "grew", isNew: false, fact: facts[1] });
  });
  it("past the 3rd time: no new fact (all are open)", () => {
    const rows = ["01", "02", "03", "08"].map((d, i) => row(d, "feel", "lan_hai", i));
    expect(feelGrowthOf(monthView("2026-11", "rung", rows, "2026-11-08")!)).toMatchObject({ isNew: false, fact: null });
  });
  it("a second visit the same day: the same plant, nothing new opens", () => {
    expect(feelGrowthOf(monthView("2026-11", "rung", [row("08", "feel", "lan_hai")], "2026-11-08")!, true)).toMatchObject({ name: "Lan hài", again: true, fact: null, animal: null });
  });
  it("nothing grew in Cảm xúc today (only another area, or another day): no reward", () => {
    expect(feelGrowthOf(monthView("2026-11", "rung", [row("08", "study", "cay_da"), row("07", "feel", "lan_hai")], "2026-11-08")!)).toBeNull();
  });
});

describe("R6b living scene data", () => {
  const row = (d: string, pillar: Pillar, item: string, variant = 0): WorldRow => ({ local_date: `2026-11-${d}`, pillar, world_key: "rung", item_key: item, variant });
  it("each thing keeps its place in its area (pack order), whatever grew first", () => {
    const v = monthView("2026-11", "rung", [row("01", "feel", "hoa_sim"), row("02", "feel", "lan_hai")], "2026-11-09")!;
    expect(v.things.map((t) => [t.key, t.slot])).toEqual([
      ["hoa_sim", RUNG.things.feel.findIndex((t) => t.key === "hoa_sim")],
      ["lan_hai", 0],
    ]);
  });
  it("waiting visitors: closest first, at most 4, names + why only (no facts)", () => {
    const v = monthView("2026-11", "rung", [row("01", "feel", "lan_hai")], "2026-11-09")!;
    expect(v.coming.length).toBe(4);
    expect(v.coming.map((c) => c.missing)).toEqual([...v.coming.map((c) => c.missing)].sort((a, b) => a - b));
    for (const c of v.coming) {
      expect(Object.keys(c).sort()).toEqual(["because", "icon", "key", "missing", "name"]);
      expect(v.animals.some((a) => a.key === c.key)).toBe(false);
    }
    // Ong mật needs 2 flowers: one is there, one is missing.
    expect(v.coming.find((c) => c.key === "ong_mat")?.missing).toBe(1);
  });
  it("visitors move by the pack or by the world", () => {
    const bee = RUNG.animals.find((a) => a.key === "ong_mat")!;
    const frog = RUNG.animals.find((a) => a.key === "ech")!;
    expect(moveOf(RUNG, bee)).toBe("fly");
    expect(moveOf(RUNG, frog)).toBe("hop");
    expect(moveOf(WORLDS.bien!, WORLDS.bien!.animals[0]!)).toBe("swim");
    expect(moveOf(WORLDS.vu_tru!, WORLDS.vu_tru!.animals[0]!)).toBe("float");
  });
});

describe("R6b scene placement (360 px screen: scene 288×216)", () => {
  // Worst case: every thing grown to its biggest (48 px), visitors 44 px.
  it("a visitor never covers more than 30% of a thing", async () => {
    const { thingPlace, animalPlace, ROWS } = await import("@/app/today/world-scene");
    for (const key of ["rung", "bien", "vu_tru", "nui_lua"] as const) {
      const w = WORLDS[key]!;
      const things = PILLARS.flatMap((p) => w.things[p].map((_, slot) => thingPlace({ pillar: p, slot }, ROWS[key])));
      for (const [slot, a] of w.animals.entries()) {
        const at = animalPlace({ slot, move: moveOf(w, a) }, key);
        for (const t of things) {
          const ox = Math.max(0, 46 - Math.abs(((at.left - t.left) / 100) * 288));
          const oy = Math.max(0, 46 - Math.abs(((at.top - t.top) / 100) * 216));
          expect((Math.min(ox, 44) * Math.min(oy, 44)) / (48 * 48), `${key}/${a.key}`).toBeLessThanOrEqual(0.3);
        }
      }
    }
  });
});

describe("recentGrowth (R7b: Nhìn lại 7 ngày)", () => {
  const r = (date: string, pillar: Pillar, world: string, item: string, variant = 0): WorldRow => ({ local_date: date, pillar, world_key: world, item_key: item, variant });
  const lan = findThing(RUNG, "lan_hai")!.thing;
  const ban = findThing(RUNG, "hoa_ban")!.thing;
  const da = findThing(RUNG, "cay_da")!.thing;
  const quy = findThing(BIEN, "hai_quy")!.thing;
  const co = findThing(BIEN, "co_bien")!.thing;
  // November in the forest, December in the sea; today = 03/12, so the window is 27/11 … 03/12.
  const rows: WorldRow[] = [
    r("2026-11-20", "feel", "rung", "lan_hai"),
    r("2026-11-25", "feel", "rung", "lan_hai", 1),
    r("2026-11-26", "study", "rung", "tre"),
    r("2026-11-28", "study", "rung", "cay_da"),
    r("2026-11-28", "feel", "rung", "lan_hai", 2),
    r("2026-11-29", "feel", "rung", "lan_hai", 3),
    r("2026-11-30", "feel", "rung", "hoa_ban"),
    r("2026-12-01", "feel", "bien", "hai_quy"),
    r("2026-12-03", "study", "bien", "co_bien"),
    r("2026-12-04", "study", "bien", "rong_nho"),
  ];
  const days = recentGrowth(rows, "2026-12-03");

  it("covers the last 7 days across a month boundary, newest first; days with nothing are left out", () => {
    expect(days.map((d) => d.date)).toEqual(["2026-12-03", "2026-12-01", "2026-11-30", "2026-11-29", "2026-11-28"]);
  });

  it("ignores rows before the window and after today", () => {
    const keys = days.flatMap((d) => d.items.map((i) => i.key));
    expect(keys).not.toContain("tre");
    expect(keys).not.toContain("rong_nho");
  });

  it("opens the fact of the row's rank in its month (rows before the window count); MAX_FACTS caps it", () => {
    expect(MAX_FACTS).toBe(3);
    const d28 = days.find((d) => d.date === "2026-11-28")!;
    // Feel before study inside a day, visitors last (tắc kè: 1 flower + 2 big trees, one of them grown before the window).
    expect(d28.items.map((i) => i.key)).toEqual(["lan_hai", "cay_da", "tac_ke"]);
    expect(d28.items[0]).toMatchObject({ kind: "thing", name: lan.name, pillar: "feel", isNew: false, fact: lan.facts[2], month: "2026-11", world: "Rừng nhiệt đới" });
    expect(d28.items[1]).toMatchObject({ kind: "thing", pillar: "study", isNew: true, fact: da.facts[0], icon: da.icon });
    // The 4th growth of lan hài: every fact is already open.
    expect(days.find((d) => d.date === "2026-11-29")!.items).toEqual([expect.objectContaining({ key: "lan_hai", isNew: false, fact: null })]);
  });

  it("lists the visitors that arrived that day after the things, in each month's own world", () => {
    const d30 = days.find((d) => d.date === "2026-11-30")!;
    expect(d30.items.map((i) => [i.kind, i.key])).toEqual([
      ["thing", "hoa_ban"],
      ["animal", "ong_mat"],
    ]);
    expect(d30.items[0]).toMatchObject({ isNew: true, fact: ban.facts[0] });
    expect(d30.items[1]).toMatchObject({ name: "Ong mật", pillar: null, fact: null, world: "Rừng nhiệt đới" });
    const d1 = days.find((d) => d.date === "2026-12-01")!;
    expect(d1.items.map((i) => i.key)).toEqual(["hai_quy", "ca_he"]);
    expect(d1.items[0]).toMatchObject({ month: "2026-12", world: BIEN.name, isNew: true, fact: quy.facts[0] });
    expect(days[0]!.items.map((i) => i.key)).toEqual(["co_bien", "rua_bien"]);
    expect(days[0]!.items[0]).toMatchObject({ fact: co.facts[0] });
  });

  it("an empty window, unknown keys or unknown worlds give nothing", () => {
    expect(recentGrowth([], "2026-12-03")).toEqual([]);
    expect(recentGrowth(rows, "2026-11-10")).toEqual([]);
    expect(recentGrowth([r("2026-12-02", "feel", "bien", "gone_key"), r("2026-12-02", "study", "no_world", "x")], "2026-12-03")).toEqual([]);
  });

  it("a shorter window", () => {
    expect(recentGrowth(rows, "2026-12-03", 3).map((d) => d.date)).toEqual(["2026-12-03", "2026-12-01"]);
  });

  it("labels days calmly: Hôm nay, Hôm qua, then the weekday and date", () => {
    expect(recentDayLabel("2026-12-03", "2026-12-03")).toBe("Hôm nay");
    expect(recentDayLabel("2026-12-02", "2026-12-03")).toBe("Hôm qua");
    expect(recentDayLabel("2026-11-30", "2026-12-03")).toBe("Thứ Hai 30/11");
    expect(recentDayLabel("2026-11-05", "2026-11-08")).toBe("Thứ Năm 05/11");
    expect(recentDayLabel("2026-11-08", "2026-11-10")).toBe("Chủ nhật 08/11");
  });
});
