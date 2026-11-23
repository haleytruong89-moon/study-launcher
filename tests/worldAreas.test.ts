import { describe, expect, it } from "vitest";
import type { DayState, TaskView } from "@/lib/dayState/types";
import { worldAreasDone, worldProgress } from "@/lib/world/areas";

const t = (key: string, source: "homework" | "template", done: boolean, patch: Partial<TaskView> = {}) =>
  ({ key, source, doneAt: done ? "2026-11-22T14:00:00Z" : null, placeholder: false, group: source === "homework" ? "due" : null, ...patch }) as TaskView;

const state = (p1: TaskView[], p2: TaskView[], pick = { needed: 0, done: 0 }) =>
  ({ part1: { items: p1, pick }, part2: { items: p2 } }) as unknown as DayState;

describe("An's world areas (parent decision 22/11/2026)", () => {
  it("An tonight: 3 school homework done, 2 practice not → the Học tập plant grows, Kỹ năng waits", () => {
    const s = state([t("h1", "homework", true), t("h2", "homework", true), t("h3", "homework", true), t("en", "template", false), t("ma", "template", false)], []);
    expect(worldProgress(s)).toEqual({ study: { done: 3, total: 3 }, skill: { done: 0, total: 2 } });
    expect(worldAreasDone(s)).toEqual(["study"]);
  });

  it("practice counts with the skills of the day; placeholders and upcoming homework are not counted", () => {
    const s = state(
      [t("h1", "homework", false), t("up", "homework", true, { group: "upcoming" }), t("en", "template", true), t("x", "template", false, { placeholder: true })],
      [t("k1", "template", true)],
    );
    expect(worldProgress(s)).toEqual({ study: { done: 0, total: 1 }, skill: { done: 2, total: 2 } });
    expect(worldAreasDone(s)).toEqual(["skill"]);
  });

  it("a day with no due homework: the 'làm trước' quota is the Học tập area", () => {
    const s = state([t("up", "homework", true, { group: "upcoming" })], [], { needed: 1, done: 1 });
    expect(worldProgress(s).study).toEqual({ done: 1, total: 1 });
    expect(worldAreasDone(s)).toEqual(["study"]);
  });

  it("an area with no task grows nothing", () => {
    expect(worldAreasDone(state([], []))).toEqual([]);
  });
});
