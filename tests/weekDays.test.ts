import { describe, expect, it } from "vitest";
import { buildWeekDays } from "@/lib/today/weekDays";

const MON = "2026-11-02";
const TODAY = "2026-11-05"; // Thursday

describe("buildWeekDays (R2 Tuần của con)", () => {
  it("always 7 days Monday → Sunday; days after today are future and empty", () => {
    const v = buildWeekDays(MON, TODAY, [{ local_date: "2026-11-06", part1_done_at: "x", part2_done_at: "x", free_started_at: "x" }], []);
    expect(v.days.map((d) => d.date)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
    expect(v.days.map((d) => d.future)).toEqual([false, false, false, false, true, true, true]);
    expect(v.days[4]).toMatchObject({ study: false, skill: false, play: false, feel: null });
  });

  it("the four areas come from the milestones and free time (any order of the parts)", () => {
    const v = buildWeekDays(
      MON,
      TODAY,
      [
        { local_date: MON, part1_done_at: "a", part2_done_at: "b", free_started_at: "c" },
        { local_date: "2026-11-03", part1_done_at: null, part2_done_at: "b", free_started_at: null },
        { local_date: "2026-11-04", part1_done_at: null, part2_done_at: null, free_started_at: "pass" },
      ],
      [],
    );
    expect(v.days.slice(0, 3).map((d) => [d.study, d.skill, d.play])).toEqual([
      [true, true, true],
      [false, true, false],
      [false, false, true],
    ]);
  });

  it("feeling = the LAST finished visit of the day; unknown quad is ignored", () => {
    const v = buildWeekDays(MON, TODAY, [], [
      { local_date: MON, quad: "blue", word_key: "met", created_at: "2026-11-02T10:00:00Z" },
      { local_date: MON, quad: "green", word_key: "binh_yen", created_at: "2026-11-02T12:00:00Z" },
      { local_date: "2026-11-03", quad: "purple", word_key: "x", created_at: "2026-11-03T12:00:00Z" },
    ]);
    expect(v.days[0]?.feel).toEqual({ quad: "green", word: "binh_yen", label: "bình yên" });
    expect(v.days[1]?.feel).toBeNull();
    expect(v.byEnabled).toBe(true);
  });

  it("Góc bình yên off → no feelings at all", () => {
    const v = buildWeekDays(MON, TODAY, [], null);
    expect(v.byEnabled).toBe(false);
    expect(v.days.every((d) => d.feel === null)).toBe(true);
  });
});
