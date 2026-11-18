import { describe, expect, it } from "vitest";
import { MAX_FACTS, monthView, pick, seedParam, type WorldRow } from "@/lib/world/rules";
import { RUNG } from "@/lib/world/rung";
import type { Pillar } from "@/lib/world/types";

const row = (d: string, pillar: Pillar, item: string): WorldRow => ({ local_date: `2026-11-${d}`, pillar, world_key: "rung", item_key: item, variant: 0 });
const TODAY = "2026-11-18";
const nextStudy = RUNG.things.study[0]!;

describe("the seed that opens task by task (An, 18/11/2026)", () => {
  it("nothing done → no seed; 1 done → the name, no fact yet", () => {
    expect(monthView("2026-11", "rung", [], TODAY, { study: { done: 0, total: 3 } })?.seeds).toEqual([]);
    const [s] = monthView("2026-11", "rung", [], TODAY, { study: { done: 1, total: 3 } })!.seeds;
    expect(s).toMatchObject({ pillar: "study", done: 1, total: 3, name: nextStudy.name, facts: [], visitor: null });
  });

  it("each next task opens one more fact (at most MAX_FACTS); it is the plant that will really grow", () => {
    const [s] = monthView("2026-11", "rung", [], TODAY, { study: { done: 3, total: 9 } })!.seeds;
    expect(s?.facts).toEqual(nextStudy.facts.slice(0, Math.min(2, MAX_FACTS)));
    const [all] = monthView("2026-11", "rung", [], TODAY, { study: { done: 8, total: 9 } })!.seeds;
    expect(all?.facts.length).toBe(Math.min(MAX_FACTS, nextStudy.facts.length));
    // The second study plant of the month is the list's second one.
    const after = monthView("2026-11", "rung", [row("10", "study", pick(RUNG, "study", 0).itemKey)], TODAY, { study: { done: 1, total: 2 } })!.seeds[0];
    expect(after?.name).toBe(RUNG.things.study[1]!.name);
  });

  it("no seed once the part is done or its plant already grew today; past months never", () => {
    expect(monthView("2026-11", "rung", [], TODAY, { study: { done: 3, total: 3 } })!.seeds).toEqual([]);
    expect(monthView("2026-11", "rung", [row("18", "study", nextStudy.key)], TODAY, { study: { done: 1, total: 3 } })!.seeds).toEqual([]);
    expect(monthView("2026-10", "rung", [], TODAY, { study: { done: 1, total: 3 } })?.seeds ?? []).toEqual([]);
  });

  it("both parts can have a seed", () => {
    const seeds = monthView("2026-11", "rung", [], TODAY, { study: { done: 1, total: 2 }, skill: { done: 2, total: 4 } })!.seeds;
    expect(seeds.map((s) => s.pillar)).toEqual(["study", "skill"]);
    expect(seeds[1]?.name).toBe(RUNG.things.skill[0]!.name);
  });

  it("from 2 tasks: the visitor this plant will bring (here: the 3rd study plant → Chim gõ kiến)", () => {
    const one = [row("01", "study", pick(RUNG, "study", 0).itemKey), row("02", "study", pick(RUNG, "study", 1).itemKey)];
    expect(monthView("2026-11", "rung", one, TODAY, { study: { done: 1, total: 3 } })!.seeds[0]?.visitor).toBeNull();
    expect(monthView("2026-11", "rung", one, TODAY, { study: { done: 2, total: 3 } })!.seeds[0]?.visitor?.name).toBe("Chim gõ kiến");
  });

  it("seedParam reads 'done/total' and nothing else", () => {
    expect(seedParam("2/3")).toEqual({ done: 2, total: 3 });
    expect(seedParam("0/0")).toBeUndefined();
    expect(seedParam("4/3")).toBeUndefined();
    expect(seedParam("x")).toBeUndefined();
    expect(seedParam(null)).toBeUndefined();
  });
});
