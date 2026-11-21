import { describe, expect, it } from "vitest";
import type { TaskView } from "@/lib/dayState/types";
import { classPrep } from "@/lib/schedule/classPrep";
import type { ExtraClass } from "@/lib/schedule/rules";
import { subjectKeyIn } from "@/lib/timetable/rules";

const eng = { key: "t:eng", source: "template", part: 1, subject: "English", title: "English OS", appSlotId: "os", state: "todo" } as TaskView;
const math = { key: "t:math", source: "template", part: 1, subject: "Math", title: "Toán", appSlotId: "mos", state: "todo" } as TaskView;
const hwToan = { key: "h:1", source: "homework", part: 1, subject: "Toán", title: "Toán", appSlotId: null, state: "todo" } as TaskView;
const gs = {
  id: "g",
  childId: "n",
  subject: "Gia sư Tiếng Anh",
  sessions: [{ day: 4, start: "20:30", end: "22:30" }],
  place: "online",
  bring: "",
  note: "",
  appSlotId: "os",
  active: true,
} as ExtraClass;
const toan = { ...gs, id: "t", subject: "Toán", sessions: [{ day: 6, start: "13:30", end: "15:30" }], appSlotId: null } as ExtraClass;
// Thursday 26/11/2026 16:00 VN = 09:00Z
const thu16 = Date.parse("2026-11-26T09:00:00Z");

describe("classPrep — làm trước buổi học thêm (21/11/2026)", () => {
  it("tonight's online class pulls its app homework first", () => {
    expect(classPrep([eng, math], [gs], thu16, "2026-11-26")).toEqual([
      { taskKey: "t:eng", label: "Trước buổi Gia sư Tiếng Anh 20:30 tối nay", startsAtMs: Date.parse("2026-11-26T13:30:00Z"), extraId: "g" },
    ]);
  });

  it("after the class has started it no longer counts for today", () => {
    expect(classPrep([eng], [gs], Date.parse("2026-11-26T13:40:00Z"), "2026-11-26")).toEqual([]);
  });

  it("tomorrow's class counts too; without an app slot, same-subject set tasks match, school homework never", () => {
    // Friday 27/11 → Saturday Toán 13:30
    const fri = Date.parse("2026-11-27T10:00:00Z");
    expect(classPrep([math, hwToan], [toan], fri, "2026-11-27").map((p) => [p.taskKey, p.label])).toEqual([["t:math", "Mai học thêm Toán 13:30"]]);
  });

  it("an afternoon class today says chiều nay; the earliest class wins", () => {
    const anEng = { ...gs, id: "a", subject: "Tiếng Anh", sessions: [{ day: 4, start: "15:30", end: "17:30" }, { day: 5, start: "14:00", end: "16:00" }] } as ExtraClass;
    const thu8 = Date.parse("2026-11-26T01:00:00Z");
    expect(classPrep([eng], [gs, anEng], thu8, "2026-11-26")).toEqual([
      { taskKey: "t:eng", label: "Trước buổi Tiếng Anh 15:30 chiều nay", startsAtMs: Date.parse("2026-11-26T08:30:00Z"), extraId: "a" },
    ]);
  });

  it("done, placeholder and inactive classes are skipped", () => {
    expect(classPrep([{ ...eng, state: "done" }], [gs], thu16, "2026-11-26")).toEqual([]);
    expect(classPrep([{ ...eng, state: "placeholder" }], [gs], thu16, "2026-11-26")).toEqual([]);
    expect(classPrep([eng], [{ ...gs, active: false }], thu16, "2026-11-26")).toEqual([]);
  });

  it("no class later today or tomorrow → nothing", () => {
    // Monday 23/11: gia sư is T5–CN only, tomorrow is Tuesday
    expect(classPrep([eng], [{ ...gs, sessions: [{ day: 4, start: "20:30", end: "22:30" }] }], Date.parse("2026-11-23T05:00:00Z"), "2026-11-23")).toEqual([]);
  });
});

describe("subjectKeyIn", () => {
  it("finds the subject inside a class name", () => {
    expect(subjectKeyIn("Gia sư Tiếng Anh")).toBe("anh");
    expect(subjectKeyIn("TA HSG")).toBe("anh");
    expect(subjectKeyIn("Toán 9 nâng cao")).toBe("toan");
    expect(subjectKeyIn("Gia sư Văn")).toBe("van");
    expect(subjectKeyIn("English")).toBe("anh");
    expect(subjectKeyIn("Cờ vua")).toBe("co vua");
  });
});
