import { describe, expect, it } from "vitest";
import { computeDayState, type DayInput, type DaySessionInput } from "@/lib/dayState";
import { cleanPlan, hoursMinutes, isIcon, nextFromPlan, planProgress, reviewWeek, weekStats } from "@/lib/today/week";

const at = (d: string, t: string) => new Date(`${d}T${t}+07:00`);
const iso = (d: string, t: string) => at(d, t).toISOString();
const TODAY = "2026-10-14"; // Wednesday

function day(patch: Partial<DayInput> = {}): DayInput {
  return {
    settings: { breakMinutes: 10, freeMinutes: 45, extraMinMinutes: 20, skillMinMinutes: 20, passesPerWeek: 1, trustUpPct: 90, trustUpWeeks: 3, trustDownPct: 70, homeworkLookaheadDays: 1, homeworkMinUpcoming: 1 },
    bedtime: "21:30",
    trustMode: "lock",
    sessions: [],
    homework: [
      { id: "h1", subject: "Toán", dueDate: "2026-10-15", note: null, doneAt: null, archivedAt: null, createdAt: iso("2026-10-13", "06:00") },
      { id: "h2", subject: "Văn", dueDate: "2026-10-15", note: null, doneAt: null, archivedAt: null, createdAt: iso("2026-10-13", "07:00") },
      { id: "h3", subject: "Anh", dueDate: "2026-10-20", note: null, doneAt: null, archivedAt: null, createdAt: iso("2026-10-13", "08:00") },
    ],
    templates: [{ id: "s1", part: "skill", title: "Đọc sách", subject: null, appSlotId: null, weekdays: [3], minMinutes: 0, deepLink: null, sort: 0, active: true }],
    appSlots: [],
    runs: [],
    overrides: [],
    ...patch,
  };
}

const session = (localDate: string, patch: Partial<DaySessionInput> = {}): DaySessionInput => ({
  localDate,
  dayType: "normal",
  disabledTemplateIds: [],
  breakStartedAt: null,
  breakEndedAt: null,
  breakSkipped: false,
  part1DoneAt: null,
  part2DoneAt: null,
  freeStartedAt: null,
  passUsedAt: null,
  ...patch,
});

describe("icons", () => {
  it("accepts only the fixed set", () => {
    expect(isIcon("🦊")).toBe(true);
    expect(isIcon("💩")).toBe(false);
    expect(isIcon("<script>")).toBe(false);
    expect(isIcon(3)).toBe(false);
  });
});

describe("day plan (display only)", () => {
  const s = computeDayState(day(), at(TODAY, "15:00"));

  it("keeps only today's task keys, in order, without duplicates", () => {
    expect(cleanPlan(s, ["homework:h2", "homework:h2", "homework:zz", "homework:h1", "template:s1"])).toEqual(["homework:h2", "homework:h1", "template:s1"]);
    expect(cleanPlan(s, ["homework:zz"])).toBeNull();
  });

  it("next task follows the plan (skills too: both parts are open, R1), and a running task wins", () => {
    expect(nextFromPlan(s, ["template:s1", "homework:h2", "homework:h1"])?.id).toBe("s1");
    expect(nextFromPlan(s, ["homework:h2", "template:s1"])?.id).toBe("h2");
    expect(nextFromPlan(s, ["homework:h3"])?.id).toBe("h3"); // the child may plan upcoming work first
    expect(nextFromPlan(s, null)).toBeNull();
    const running = computeDayState(
      day({ runs: [{ id: "r", localDate: TODAY, source: "homework", homeworkItemId: "h1", templateId: null, startedAt: iso(TODAY, "14:55"), doneAt: null, proofPaths: [] }] }),
      at(TODAY, "15:00"),
    );
    expect(nextFromPlan(running, ["homework:h2"])?.id).toBe("h1");
  });

  it("plan progress counts planned tasks done today", () => {
    const done = computeDayState(day({ homework: day().homework.map((h) => (h.id === "h1" ? { ...h, doneAt: iso(TODAY, "14:00") } : h)) }), at(TODAY, "15:00"));
    expect(planProgress(done, ["homework:h1", "homework:h2"])).toEqual({ done: 1, total: 2 });
  });

  it("a plan never changes the lock state", () => {
    const before = computeDayState(day(), at(TODAY, "15:00"));
    nextFromPlan(before, ["homework:h3"]);
    expect(before.status).toBe("LOCK_P1");
    expect(before.part1.total).toBe(2);
  });
});

describe("weekly review window (Sunday 17:00 -> end of Monday)", () => {
  it("opens Sunday 17:00 for this week, stays open Monday for the week that ended", () => {
    expect(reviewWeek(at("2026-10-18", "16:59"))).toBeNull();
    expect(reviewWeek(at("2026-10-18", "17:00"))).toBe("2026-10-12");
    expect(reviewWeek(at("2026-10-19", "23:59"))).toBe("2026-10-12");
    expect(reviewWeek(at("2026-10-20", "00:00"))).toBeNull();
    expect(reviewWeek(at(TODAY, "20:00"))).toBeNull();
  });
});

describe("week stats", () => {
  const W = "2026-10-12";
  it("counts ok days, early homework, minutes and plans kept", () => {
    const stats = weekStats({
      weekStart: W,
      bedtime: "21:30",
      sessions: [
        session("2026-10-12", { part1DoneAt: iso("2026-10-12", "18:00"), part2DoneAt: iso("2026-10-12", "19:00") }),
        session("2026-10-13", { part1DoneAt: iso("2026-10-13", "18:00"), part2DoneAt: iso("2026-10-13", "22:00") }), // after bedtime
        session("2026-10-14", { passUsedAt: iso("2026-10-14", "18:00") }),
        session("2026-10-15", { dayType: "sick" }),
        session("2026-10-19", { part2DoneAt: iso("2026-10-19", "19:00") }), // next week
      ],
      runs: [
        { localDate: "2026-10-12", source: "template", homeworkItemId: null, templateId: "t1", startedAt: iso("2026-10-12", "17:00"), doneAt: iso("2026-10-12", "17:25") },
        { localDate: "2026-10-12", source: "homework", homeworkItemId: "h1", templateId: null, startedAt: iso("2026-10-12", "16:00"), doneAt: iso("2026-10-12", "16:40") },
        { localDate: "2026-10-13", source: "template", homeworkItemId: null, templateId: "t1", startedAt: iso("2026-10-13", "17:00"), doneAt: null },
      ],
      homework: [
        { id: "h1", dueDate: "2026-10-15", doneAt: iso("2026-10-12", "16:40") }, // 3 days early
        { id: "h2", dueDate: "2026-10-14", doneAt: iso("2026-10-13", "20:00") }, // 1 day: not early
        { id: "h3", dueDate: "2026-10-20", doneAt: null },
      ],
      plans: [
        { localDate: "2026-10-12", itemKeys: ["homework:h1", "template:t1"] }, // kept
        { localDate: "2026-10-13", itemKeys: ["template:t1", "homework:h3"] }, // not kept
        { localDate: "2026-10-14", itemKeys: [] }, // empty = no plan
      ],
    });
    expect(stats).toEqual({ weekStart: W, okDays: 3, early: 1, minutes: 65, planDays: 2, planKeptDays: 1 });
  });

  it("hours and minutes wording", () => {
    expect(hoursMinutes(45)).toBe("45 phút");
    expect(hoursMinutes(120)).toBe("2 giờ");
    expect(hoursMinutes(130)).toBe("2 giờ 10 phút");
  });
});
