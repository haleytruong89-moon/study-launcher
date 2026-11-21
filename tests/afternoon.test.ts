import { describe, expect, it } from "vitest";
import { afternoonStrip, blockMinutes, currentBlock, stripOver } from "@/lib/schedule/afternoon";
import { extrasOn, type ExtraClass } from "@/lib/schedule/rules";
import { dayPlan, type TimetableVersion } from "@/lib/timetable/rules";

// An (6A6), Monday: afternoon school 13:50–15:25 (LS&ĐL, Anh), then Tiếng Anh 15:30–17:30.
const an: TimetableVersion = {
  id: "v",
  childId: "a",
  validFrom: "2026-11-09",
  label: "6A6",
  note: "",
  periods: [
    { day: 1, session: "am", n: 1, subject: "Chào cờ" },
    { day: 1, session: "pm", n: 2, subject: "LS&ĐL(ĐL)" },
    { day: 1, session: "pm", n: 3, subject: "Anh" },
  ],
  times: { am: { "1": "07:30-08:15" }, pm: { "2": "13:50-14:35", "3": "14:40-15:25" } },
  uniform: {},
};
const cls = (id: string, subject: string, day: number, start: string, end: string, place: ExtraClass["place"] = "center") =>
  ({ id, childId: "a", subject, sessions: [{ day, start, end }], place, bring: "", note: "", appSlotId: null, active: true }) as ExtraClass;

describe("afternoonStrip — Chiều nay (21/11/2026)", () => {
  it("An on Monday: school → Tiếng Anh → free from 17:30 (design screen 5)", () => {
    const monday = "2026-11-23";
    const blocks = afternoonStrip(dayPlan([an], monday), extrasOn([cls("e", "Tiếng Anh", 1, "15:30", "17:30")], monday));
    expect(blocks).toEqual([
      { start: "12:00", end: "13:50", kind: "free", label: "Trống" },
      { start: "13:50", end: "15:25", kind: "school", label: "Ở trường" },
      { start: "15:30", end: "17:30", kind: "extra", label: "Tiếng Anh · Trung tâm" },
      { start: "17:30", end: "22:30", kind: "free", label: "Trống từ 17:30" },
    ]);
    expect(blocks.map(blockMinutes)).toEqual([110, 95, 120, 300]);
  });

  it("Nguyên on Thursday: Văn after lunch, online gia sư in the evening", () => {
    const thursday = "2026-11-26";
    const extras = [cls("v", "Văn", 4, "14:30", "16:30"), cls("g", "Gia sư Tiếng Anh", 4, "20:30", "22:30", "online")];
    expect(afternoonStrip(null, extrasOn(extras, thursday)).map((b) => `${b.start}–${b.end} ${b.label}`)).toEqual([
      "12:00–14:30 Trống",
      "14:30–16:30 Văn · Trung tâm",
      "16:30–20:30 Trống",
      "20:30–22:30 Gia sư Tiếng Anh · Online",
    ]);
  });

  it("back-to-back classes and short gaps leave no free block; a late class stretches the end", () => {
    const sat = "2026-11-28";
    const extras = [cls("t", "Toán", 6, "13:30", "15:30"), cls("h", "TA HSG", 6, "15:35", "17:15"), cls("x", "Cờ", 6, "22:00", "23:00")];
    expect(afternoonStrip(null, extrasOn(extras, sat)).map((b) => `${b.start}–${b.end} ${b.kind}`)).toEqual([
      "12:00–13:30 free",
      "13:30–15:30 extra",
      "15:35–17:15 extra",
      "17:15–22:00 free",
      "22:00–23:00 extra",
    ]);
  });

  it("overlapping classes are both listed; morning-only days and empty days give nothing", () => {
    const tue = "2026-11-24";
    const both = afternoonStrip(null, extrasOn([cls("a", "Văn", 2, "15:30", "17:00"), cls("b", "Toán", 2, "16:00", "18:00")], tue));
    expect(both.filter((b) => b.kind === "extra").map((b) => b.start)).toEqual(["15:30", "16:00"]);
    expect(both.at(-1)).toEqual({ start: "18:00", end: "22:30", kind: "free", label: "Trống từ 18:00" });
    expect(afternoonStrip(dayPlan([an], "2026-11-24"), [])).toEqual([]); // An has no Tuesday lesson here
    expect(afternoonStrip(null, extrasOn([cls("m", "Bơi", 2, "06:00", "07:00")], tue))).toEqual([]);
  });

  it("the block going on now, and when the strip is over", () => {
    const blocks = afternoonStrip(null, extrasOn([cls("e", "Tiếng Anh", 1, "15:30", "17:30")], "2026-11-23"));
    expect(currentBlock(blocks, 16 * 60)).toBe(1);
    expect(currentBlock(blocks, 11 * 60)).toBeNull();
    expect(stripOver(blocks, 22 * 60 + 29)).toBe(false);
    expect(stripOver(blocks, 22 * 60 + 30)).toBe(true);
    expect(stripOver([], 0)).toBe(true);
  });
});
