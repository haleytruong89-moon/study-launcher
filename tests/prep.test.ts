import { describe, expect, it } from "vitest";
import type { TaskView } from "@/lib/dayState/types";
import { classPrep } from "@/lib/schedule/classPrep";
import { prepDone, prepItems, tickableKeys } from "@/lib/schedule/prep";
import { extrasOn, subjectRows, type ExtraClass } from "@/lib/schedule/rules";
import { dayPlan, nextSchoolDay, type Period, type TimetableVersion } from "@/lib/timetable/rules";

const p = (day: number, n: number, subject: string): Period => ({ day, session: "am", n, subject });

// Nguyên (9A13): Friday has Toán ×2, Địa lí, Thể dục, Lịch sử.
const nguyen: TimetableVersion = {
  id: "v",
  childId: "n",
  validFrom: "2026-11-01",
  label: "HK1",
  note: "",
  periods: [p(4, 1, "Văn"), p(5, 1, "Toán"), p(5, 2, "Toán"), p(5, 3, "Địa lí"), p(5, 4, "Thể dục"), p(5, 5, "Lịch sử")],
  times: {},
  uniform: { "1": "Áo đồng phục lớp", "5": "Áo đồng phục lớp", "4": "Áo trắng", pe: "Đồng phục thể dục (áo xanh lá)" },
};
const gs = {
  id: "g",
  childId: "n",
  subject: "Gia sư Tiếng Anh",
  sessions: [4, 5, 6, 7].map((day) => ({ day, start: "20:30", end: "22:30" })),
  place: "online",
  bring: "",
  note: "",
  appSlotId: "os",
  active: true,
} as ExtraClass;
const toanT6 = { ...gs, id: "t", subject: "Toán", sessions: [{ day: 5, start: "14:00", end: "16:00" }], place: "center", bring: "Vở bài tập", appSlotId: null } as ExtraClass;
const eng = { key: "template:eng", source: "template", part: 1, subject: "English", title: "English OS", appSlotId: "os", state: "todo" } as TaskView;

describe("prepItems — Chuẩn bị cho ngày mai (21/11/2026)", () => {
  it("Nguyên on Thursday evening: 4 rows to tick + the English OS homework before tonight's class", () => {
    const today = "2026-11-26"; // Thursday
    const now = Date.parse("2026-11-26T12:30:00Z"); // 19:30 VN
    const plan = nextSchoolDay([nguyen], today);
    expect(plan?.date).toBe("2026-11-27");
    const extras = [gs, toanT6];
    const items = prepItems({
      plan,
      extrasNext: extrasOn(extras, plan!.date),
      rows: subjectRows(nguyen, extras, []),
      prep: classPrep([eng], extras, now, today, { includeDone: true }),
      items: [eng],
      ticked: ["books"],
    });
    expect(items.map((i) => [i.key, i.title, i.text, i.auto, i.done])).toEqual([
      ["books", "Sách vở 4 môn", "Toán (2 tiết) · Địa lí · Thể dục · Lịch sử", false, true],
      ["bring", "Đồ dùng", "Toán: Thước, compa · Thể dục: Giày thể thao, nước", false, false],
      ["uniform", "Đồng phục", "Đồng phục thể dục (áo xanh lá)", false, false],
      ["extras", "Học thêm (2 buổi)", "14:00–16:00 Toán · Vở bài tập · 20:30–22:30 Gia sư Tiếng Anh", false, false],
      ["hw:template:eng", "Làm xong English · English OS", "Trước buổi Gia sư Tiếng Anh 20:30 tối nay", true, false],
    ]);
    expect(tickableKeys(items)).toEqual(["books", "bring", "uniform", "extras"]);
    expect(prepDone(items, ["books", "bring", "uniform"])).toBe(false);
    expect(prepDone(items, ["books", "bring", "uniform", "extras"])).toBe(true);
  });

  it("a done app homework stays on the list, ticked by itself", () => {
    const now = Date.parse("2026-11-26T12:30:00Z");
    const done = { ...eng, state: "done" } as TaskView;
    const items = prepItems({
      plan: dayPlan([nguyen], "2026-11-27"),
      extrasNext: [],
      rows: [],
      prep: classPrep([done], [gs], now, "2026-11-26", { includeDone: true }),
      items: [done],
      ticked: [],
    });
    expect(items.find((i) => i.key === "hw:template:eng")).toMatchObject({ auto: true, done: true });
    expect(classPrep([done], [gs], now, "2026-11-26")).toEqual([]);
  });

  it("An on Monday: the uniform comes from the weekday table; empty rows are left out", () => {
    const an: TimetableVersion = { ...nguyen, childId: "a", periods: [p(1, 1, "Chào cờ"), p(1, 2, "Ngữ văn"), p(1, 3, "Ngữ văn")], uniform: { "1": "Áo trắng, quần xanh, khăn quàng" } };
    const items = prepItems({ plan: dayPlan([an], "2026-11-23"), extrasNext: [], rows: subjectRows(an, [], []), prep: [], items: [], ticked: [] });
    expect(items.map((i) => [i.key, i.text])).toEqual([
      ["books", "Chào cờ · Ngữ văn (2 tiết)"],
      ["uniform", "Áo trắng, quần xanh, khăn quàng"],
    ]);
  });

  it("no school day → nothing", () => {
    expect(prepItems({ plan: null, extrasNext: [], rows: [], prep: [], items: [], ticked: [] })).toEqual([]);
    expect(prepDone([], [])).toBe(false);
  });
});
