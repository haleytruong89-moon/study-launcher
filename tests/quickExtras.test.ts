import { describe, expect, it } from "vitest";
import { parseQuickExtras, planQuickExtras, QUICK_EXTRAS_HEADER, toQuickExtras } from "@/lib/schedule/quickExtras";

const slots = [
  { id: "os", label: "English OS" },
  { id: "math", label: "Math OS" },
];

// The parent's list for Nguyên (21/11/2026).
const NGUYEN = `${QUICK_EXTRAS_HEADER}
Gia sư Tiếng Anh | T5 T6 T7 CN 20:30-22:30 | Online | English OS |
Văn | T3 13:30-15:30; T5 14:30-16:30 | Trung tâm | |
Toán | T2 14:00-16:00; T7 13:30-15:30 | | |
Tiếng Anh HSG | T7 15:45-17:15 | | | Vở HSG`;

describe("parseQuickExtras — Dán học thêm (22/11/2026)", () => {
  it("reads the parent's list: days, times, place, app, bring", () => {
    const r = parseQuickExtras(NGUYEN, slots);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.classes).toEqual([
      {
        subject: "Gia sư Tiếng Anh",
        sessions: [4, 5, 6, 7].map((day) => ({ day, start: "20:30", end: "22:30" })),
        place: "online",
        appSlotId: "os",
        bring: "",
        note: "",
      },
      {
        subject: "Văn",
        sessions: [
          { day: 2, start: "13:30", end: "15:30" },
          { day: 4, start: "14:30", end: "16:30" },
        ],
        place: "center",
        appSlotId: null,
        bring: "",
        note: "",
      },
      {
        subject: "Toán",
        sessions: [
          { day: 1, start: "14:00", end: "16:00" },
          { day: 6, start: "13:30", end: "15:30" },
        ],
        place: "center",
        appSlotId: null,
        bring: "",
        note: "",
      },
      { subject: "Tiếng Anh HSG", sessions: [{ day: 6, start: "15:45", end: "17:15" }], place: "center", appSlotId: null, bring: "Vở HSG", note: "" },
    ]);
  });

  it("accepts 8h30-10h30, commas, Ở nhà and any case / accents for the app", () => {
    const r = parseQuickExtras("Cờ vua | t2,t4 8h30 - 10h | ở nhà | english os", slots);
    expect(r.ok && r.classes[0]).toEqual({
      subject: "Cờ vua",
      sessions: [
        { day: 1, start: "08:30", end: "10:00" },
        { day: 3, start: "08:30", end: "10:00" },
      ],
      place: "home",
      appSlotId: "os",
      bring: "",
      note: "",
    });
  });

  it("says which line is wrong and why", () => {
    const r = parseQuickExtras(
      ["Văn | T3 13:30-15:30", "Văn | T5 14:30-16:30", " | T2 14:00-16:00", "Toán | Thứ hai 14:00-16:00", "Bơi | T2 16:00-15:00", "Vẽ | T2 16:00-17:00 | Sân", "Nhạc | T3 16:00-17:00 | | Zoom"].join("\n"),
      slots,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toEqual([
      'Dòng 2: "Văn" đã có ở dòng trên — gộp các buổi vào 1 dòng, cách nhau bằng ;',
      "Dòng 3: thiếu tên môn.",
      'Dòng 4: "Thứ hai 14:00-16:00": thứ viết T2 … T7 hoặc CN.',
      "Dòng 5: Giờ kết thúc phải sau giờ bắt đầu.",
      'Dòng 6: "Ở đâu" ghi Ở nhà, Trung tâm hoặc Online.',
      'Dòng 7: chưa có app "Zoom" trong danh sách app của con (English OS, Math OS).',
    ]);
  });

  it("writes the current classes back as text that reads the same", () => {
    const r = parseQuickExtras(NGUYEN, slots);
    if (!r.ok) throw new Error("parse");
    const text = toQuickExtras(
      r.classes.map((c) => ({ ...c, active: true })),
      slots,
    );
    expect(text.split("\n")[1]).toBe("Gia sư Tiếng Anh | T5 T6 T7 CN 20:30-22:30 | Online | English OS | ");
    const again = parseQuickExtras(text, slots);
    expect(again.ok && again.classes).toEqual(r.classes);
  });
});

describe("planQuickExtras", () => {
  it("updates classes still listed (by subject, any accents), adds new ones, turns off the rest", () => {
    const r = parseQuickExtras("van | T3 13:30-15:30\nToán | T2 14:00-16:00", slots);
    if (!r.ok) throw new Error("parse");
    const plan = planQuickExtras(
      [
        { id: "a", subject: "Văn", active: true },
        { id: "b", subject: "Bơi", active: true },
        { id: "c", subject: "Toán", active: false },
      ],
      r.classes,
    );
    expect(plan.update.map((u) => [u.id, u.data.subject])).toEqual([["a", "van"]]);
    expect(plan.insert.map((c) => c.subject)).toEqual(["Toán"]);
    expect(plan.off).toEqual(["b"]);
  });
});
