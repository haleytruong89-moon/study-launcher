import { describe, expect, it } from "vitest";
import { childDayTypeNote, decideSpecialDay, specialDayWindow, templatesForDate, type TemplateForDay } from "@/lib/admin/specialDay";
import { computeDayState, isDayOk, type DayInput, type DaySessionInput } from "@/lib/dayState";

// 2026-11-02 is a Monday (weekday 1); 2026-11-03 a Tuesday.
const at = (date: string, time: string) => new Date(`${date}T${time}+07:00`);
const NOW = at("2026-11-02", "19:00");

const T = (id: string, part: "extra" | "skill", weekdays: number[], extra: Partial<TemplateForDay> = {}): TemplateForDay => ({
  id,
  part,
  title: id,
  weekdays,
  sort: 0,
  active: true,
  ...extra,
});
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const C = "00000000-0000-4000-8000-00000000000c";
const OFF = "00000000-0000-4000-8000-00000000000d";
const templates = [T(B, "skill", [1, 2]), T(A, "extra", [1]), T(C, "extra", [2]), T(OFF, "extra", [1], { active: false })];

describe("special days: what a parent may set (server clock)", () => {
  it("allows today up to 60 days ahead, never a past day", () => {
    expect(specialDayWindow(NOW)).toEqual({ from: "2026-11-02", to: "2027-01-01" });
    // 00:30 on the 3rd is already the 3rd in Vietnam.
    expect(specialDayWindow(new Date("2026-11-02T17:30:00Z")).from).toBe("2026-11-03");
    const req = { dayType: "sick" as const, disabledTemplateIds: [] };
    expect(decideSpecialDay({ ...req, date: "2026-11-01" }, NOW, templates)).toEqual({ ok: false, error: "Không đổi được ngày đã qua." });
    expect(decideSpecialDay({ ...req, date: "2026-11-02" }, NOW, templates).ok).toBe(true);
    expect(decideSpecialDay({ ...req, date: "2027-01-01" }, NOW, templates).ok).toBe(true);
    expect(decideSpecialDay({ ...req, date: "2027-01-02" }, NOW, templates).ok).toBe(false);
  });

  it("lists the active tasks of that weekday, Part 1 first", () => {
    expect(templatesForDate(templates, "2026-11-02").map((t) => t.id)).toEqual([A, B]);
    expect(templatesForDate(templates, "2026-11-03").map((t) => t.id)).toEqual([C, B]);
  });

  it("exam / holiday keep only tasks of that day; duplicates removed, stable order", () => {
    expect(decideSpecialDay({ date: "2026-11-02", dayType: "exam", disabledTemplateIds: [B, A, A] }, NOW, templates)).toEqual({
      ok: true,
      row: { day_type: "exam", disabled_template_ids: [A, B] },
    });
    expect(decideSpecialDay({ date: "2026-11-03", dayType: "holiday", disabledTemplateIds: [] }, NOW, templates)).toEqual({
      ok: true,
      row: { day_type: "holiday", disabled_template_ids: [] },
    });
    // A task of another weekday, a turned-off task, or an unknown id is refused.
    expect(decideSpecialDay({ date: "2026-11-02", dayType: "exam", disabledTemplateIds: [C] }, NOW, templates).ok).toBe(false);
    expect(decideSpecialDay({ date: "2026-11-02", dayType: "exam", disabledTemplateIds: [OFF] }, NOW, templates).ok).toBe(false);
  });

  it("normal and sick clear the turned-off list", () => {
    for (const dayType of ["normal", "sick"] as const) {
      expect(decideSpecialDay({ date: "2026-11-02", dayType, disabledTemplateIds: [A] }, NOW, templates)).toEqual({
        ok: true,
        row: { day_type: dayType, disabled_template_ids: [] },
      });
    }
  });

  it("child labels: none on a normal day", () => {
    expect(childDayTypeNote("normal")).toBeNull();
    expect(childDayTypeNote("exam")).toContain("Ngày thi");
    expect(childDayTypeNote("holiday")).toContain("Ngày lễ");
    expect(childDayTypeNote("sick")).toContain("Ngày ốm");
  });
});

// The effects come from computeDayState unchanged; these tests pin what the parent's choice does.
describe("special days: effect on the child's day (existing state machine)", () => {
  const session = (over: Partial<DaySessionInput>): DaySessionInput => ({
    localDate: "2026-11-02",
    dayType: "normal",
    disabledTemplateIds: [],
    breakStartedAt: null,
    breakEndedAt: null,
    breakSkipped: false,
    part1DoneAt: null,
    part2DoneAt: null,
    freeStartedAt: null,
    passUsedAt: null,
    ...over,
  });
  const input = (s: DaySessionInput): DayInput => ({
    settings: {
      breakMinutes: 10,
      freeMinutes: 45,
      extraMinMinutes: 20,
      skillMinMinutes: 20,
      passesPerWeek: 1,
      trustUpPct: 90,
      trustUpWeeks: 3,
      trustDownPct: 70,
      homeworkLookaheadDays: 1,
      homeworkMinUpcoming: 0,
    },
    bedtime: "21:30",
    trustMode: "lock",
    sessions: [s],
    homework: [],
    templates: templates.map((t) => ({ ...t, subject: null, appSlotId: null, minMinutes: null, deepLink: null })),
    appSlots: [],
    runs: [],
    overrides: [],
  });

  it("sick: open until 00:00 and the day counts", () => {
    const s = computeDayState(input(session({ dayType: "sick" })), NOW);
    expect(s.status).toBe("OPEN_SICK");
    expect(s.openUntil).toBe(new Date("2026-11-03T00:00:00+07:00").toISOString());
    expect(isDayOk(session({ dayType: "sick" }), "21:30")).toBe(true);
  });

  it("exam: turned-off tasks disappear, the rest still locks; not counted until done", () => {
    const s = computeDayState(input(session({ dayType: "exam", disabledTemplateIds: [A] })), NOW);
    expect(s.dayType).toBe("exam");
    expect(s.part1.items.map((i) => i.id)).toEqual([]);
    expect(s.part2.items.map((i) => i.id)).toEqual([B]);
    expect(s.open).toBe(false);
    expect(isDayOk(session({ dayType: "exam" }), "21:30")).toBe(false);
  });

  it("holiday: counted as đạt even with tasks left", () => {
    expect(isDayOk(session({ dayType: "holiday" }), "21:30")).toBe(true);
    const s = computeDayState(input(session({ dayType: "holiday", disabledTemplateIds: [B] })), NOW);
    expect(s.part2.items).toHaveLength(0);
    expect(s.part1.items.map((i) => i.id)).toEqual([A]);
    expect(s.status).toBe("LOCK_P1");
  });
});
