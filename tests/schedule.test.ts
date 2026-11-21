import { describe, expect, it } from "vitest";
import {
  childValidFromOk,
  cleanSessions,
  conflicts,
  dayShort,
  defaultBring,
  diffPeriods,
  extraBusy,
  extrasOn,
  fromExtraRow,
  normClock,
  schoolBusy,
  sessionsText,
  subjectRows,
  type ExtraClass,
} from "@/lib/schedule/rules";
import type { TimetableVersion } from "@/lib/timetable/rules";

// An's 6A6 afternoon: T2/T3 C2–C3 13:50–15:25 (data from 21/11/2026).
const an: TimetableVersion = {
  id: "v",
  childId: "an",
  validFrom: "2026-11-09",
  label: "6A6",
  note: "",
  periods: [
    { day: 1, session: "am", n: 1, subject: "CHAOCO" },
    { day: 1, session: "pm", n: 2, subject: "LS&ĐL(ĐL)" },
    { day: 1, session: "pm", n: 3, subject: "ANH" },
    { day: 2, session: "am", n: 5, subject: "Toán" },
    { day: 2, session: "pm", n: 2, subject: "KHTN(H)" },
    { day: 2, session: "pm", n: 3, subject: "KHTN(S)" },
    { day: 4, session: "am", n: 1, subject: "Văn" },
  ],
  times: { am: { "1": "07:30-08:15", "5": "11:00-11:45" }, pm: { "2": "13:50-14:35", "3": "14:40-15:25" } },
  uniform: {},
};
const x = (id: string, subject: string, sessions: { day: number; start: string; end: string }[]): ExtraClass => ({
  id,
  childId: "an",
  subject,
  sessions,
  place: "home",
  bring: "",
  note: "",
  appSlotId: null,
  active: true,
});

describe("extra-class sessions", () => {
  it("normalises clocks and orders sessions", () => {
    expect(normClock("8h30")).toBe("08:30");
    expect(normClock("17h")).toBe("17:00");
    expect(normClock("15:30")).toBe("15:30");
    expect(normClock("25:00")).toBeNull();
    expect(
      cleanSessions([
        { day: 4, start: "13:00", end: "14:30" },
        { day: 2, start: "15h30", end: "17h" },
      ]),
    ).toEqual([
      { day: 2, start: "15:30", end: "17:00" },
      { day: 4, start: "13:00", end: "14:30" },
    ]);
  });
  it("rejects end before start, a bad day, too many or no sessions", () => {
    expect(typeof cleanSessions([{ day: 2, start: "17:00", end: "15:30" }])).toBe("string");
    expect(typeof cleanSessions([{ day: 8, start: "15:00", end: "16:00" }])).toBe("string");
    expect(typeof cleanSessions(Array.from({ length: 8 }, (_, i) => ({ day: 1, start: `0${i}:00`, end: `0${i}:30` })))).toBe("string");
    expect(typeof cleanSessions([])).toBe("string");
  });
  it("writes them short", () => {
    expect(dayShort(7)).toBe("CN");
    expect(
      sessionsText([
        { day: 2, start: "15:30", end: "17:00" },
        { day: 4, start: "13:00", end: "14:30" },
      ]),
    ).toBe("T3 15:30–17:00, T5 13:00–14:30");
  });
});

describe("busy + conflicts", () => {
  it("school afternoon T3 is 13:50–15:25; Văn 15:30 does not clash, 13:30 does", () => {
    const busy = schoolBusy(an);
    expect(busy).toContainEqual({ day: 2, start: "13:50", end: "15:25", label: "Học chiều ở trường", kind: "school" });
    expect(conflicts([{ day: 2, start: "15:30", end: "17:00" }], busy)).toEqual([]);
    expect(conflicts([{ day: 2, start: "13:30", end: "15:00" }], busy)).toHaveLength(1);
  });
  it("other extra classes count, the one being edited does not", () => {
    const anh = x("e1", "Tiếng Anh", [{ day: 1, start: "15:30", end: "17:30" }]);
    expect(conflicts([{ day: 1, start: "17:00", end: "18:00" }], extraBusy([anh]))).toHaveLength(1);
    expect(conflicts([{ day: 1, start: "17:00", end: "18:00" }], extraBusy([anh], "e1"))).toEqual([]);
  });
  it("touching ends do not clash", () => {
    expect(conflicts([{ day: 2, start: "15:25", end: "16:00" }], schoolBusy(an))).toEqual([]);
  });
});

describe("extrasOn", () => {
  it("lists the day's classes by start time (Sunday = 7)", () => {
    const gs = x("g", "Gia sư Tiếng Anh", [
      { day: 7, start: "20:30", end: "22:30" },
      { day: 4, start: "20:30", end: "22:30" },
    ]);
    const van = x("v", "Văn", [{ day: 4, start: "14:30", end: "16:30" }]);
    expect(extrasOn([gs, van], "2026-11-26").map((e) => e.extra.id)).toEqual(["v", "g"]); // Thursday
    expect(extrasOn([gs], "2026-11-29").map((e) => e.session.start)).toEqual(["20:30"]); // Sunday
    expect(extrasOn([{ ...van, active: false }], "2026-11-26")).toEqual([]);
  });
});

describe("diffPeriods", () => {
  it("names each changed period", () => {
    const before = [{ day: 3, session: "am" as const, n: 3, subject: "Thể dục" }];
    expect(diffPeriods(before, [{ day: 3, session: "am", n: 3, subject: "Toán" }])).toEqual(["T4 tiết 3: Thể dục → Toán"]);
    expect(diffPeriods(before, [])).toEqual(["T4 tiết 3: bỏ Thể dục"]);
    expect(diffPeriods([], before)).toEqual(["T4 tiết 3: thêm Thể dục"]);
    expect(diffPeriods([{ day: 1, session: "pm", n: 2, subject: "Anh" }], [{ day: 1, session: "pm", n: 2, subject: "Văn" }])).toEqual(["T2 chiều tiết 2: Anh → Văn"]);
  });
});

describe("subjectRows", () => {
  it("counts lessons per week, merges groups, adds extra-class days and prefs", () => {
    const rows = subjectRows(
      an,
      [
        x("v", "Văn", [
          { day: 2, start: "15:30", end: "17:00" },
          { day: 4, start: "13:00", end: "14:30" },
        ]),
      ],
      [{ key: "toan", label: "", color: "#3B6FB6", bring: "Thước, compa, máy tính" }],
    );
    expect(rows.find((r) => r.key === "van")).toMatchObject({ label: "Văn", perWeek: 1, extraDays: [2, 4] });
    expect(rows.find((r) => r.key === "toan")).toMatchObject({ color: "#3B6FB6", bring: "Thước, compa, máy tính" });
    expect(rows.find((r) => r.key === "khtn")?.perWeek).toBe(2);
    expect(rows.find((r) => r.key === "chaoco")?.bring).toBe("Khăn quàng đỏ");
  });
  it("suggests a bring list by subject", () => {
    expect(defaultBring("the duc")).toBe("Giày thể thao, nước");
    expect(defaultBring("my thuat")).toBe("Bút màu, giấy vẽ");
    expect(defaultBring("van")).toBe("");
  });
});

describe("childValidFromOk", () => {
  it("edits the version in force or starts a new one up to 60 days ahead, never rewrites older history", () => {
    expect(childValidFromOk("2026-11-09", "2026-11-09", "2026-11-21")).toBeNull();
    expect(childValidFromOk("2026-12-01", "2026-11-09", "2026-11-21")).toBeNull();
    expect(childValidFromOk("2026-11-01", "2026-11-09", "2026-11-21")).toMatch(/trước/);
    expect(childValidFromOk("2027-02-01", "2026-11-09", "2026-11-21")).toMatch(/60 ngày/);
    expect(childValidFromOk("2026-11-21", null, "2026-11-21")).toBeNull();
  });
});

describe("fromExtraRow", () => {
  it("drops bad shapes", () => {
    const e = fromExtraRow({ id: "1", child_id: "c", subject: "Văn", sessions: "nope", place: "moon", bring: null, note: null, app_slot_id: null, active: true });
    expect(e).toMatchObject({ sessions: [], place: "home", bring: "" });
  });
});
