import { describe, expect, it } from "vitest";
import { auditText } from "@/lib/admin/auditText";
import { restorePlan } from "@/lib/schedule/restore";

describe("restorePlan (Khôi phục bản trước, 21/11/2026)", () => {
  it("a new timetable version is removed; an edited one gets its before back", () => {
    expect(restorePlan({ action: "schedule.timetable", payload: { id: "t1", before: null } })).toEqual({ table: "timetables", op: "delete", id: "t1" });
    const before = { valid_from: "2026-11-09", label: "9A13", note: "", periods: [], times: {}, uniform: {} };
    expect(restorePlan({ action: "schedule.timetable", payload: { id: "t1", before } })).toEqual({
      table: "timetables",
      op: "update",
      id: "t1",
      values: { label: "9A13", note: "", periods: [], times: {}, uniform: {} },
    });
  });
  it("a new extra class is turned off; an edited or turned-off one gets its before back", () => {
    expect(restorePlan({ action: "schedule.extra.save", payload: { id: "e1", before: null } })).toEqual({ table: "extra_classes", op: "update", id: "e1", values: { active: false } });
    const before = { subject: "Văn", sessions: [], place: "home", bring: "", note: "", app_slot_id: null, active: true };
    expect(restorePlan({ action: "schedule.extra.off", payload: { id: "e1", before } })).toEqual({ table: "extra_classes", op: "update", id: "e1", values: before });
  });
  it("refuses anything else", () => {
    expect(restorePlan({ action: "homework.create", payload: { id: "x" } })).toHaveProperty("error");
    expect(restorePlan({ action: "schedule.timetable", payload: { before: null } })).toHaveProperty("error");
    expect(restorePlan({ action: "schedule.timetable", payload: { id: "t1", before: "x" } })).toHaveProperty("error");
    expect(restorePlan({ action: "schedule.restore", payload: { id: "t1", before: null } })).toHaveProperty("error");
  });
});

describe("Nhật ký sentences for schedule changes", () => {
  const names = new Map([
    ["c1", "Nguyên"],
    ["c2", "An"],
  ]);
  const t = (action: string, payload: Record<string, unknown>, actor = "c1") => auditText({ action, payload, actor_id: actor }, names).text;
  it("reads like the design", () => {
    expect(t("schedule.timetable", { child_id: "c1", changes: ["T4 tiết 3: Thể dục → Toán"] })).toBe("Nguyên sửa thời khóa biểu: T4 tiết 3: Thể dục → Toán");
    expect(t("schedule.timetable", { child_id: "c1", changes: ["a", "b", "c", "d"], change_count: 5 })).toBe("Nguyên sửa thời khóa biểu: a; b; c (+2)");
    expect(t("schedule.timetable", { child_id: "c1", changes: [] })).toBe("Nguyên sửa đồng phục / giờ tiết trong thời khóa biểu");
    expect(t("schedule.extra.save", { child_id: "c2", summary: "Văn: T3 15:30–17:00", before: null, conflicts: 0 }, "c2")).toBe("An thêm học thêm Văn: T3 15:30–17:00");
    expect(t("schedule.extra.save", { child_id: "c2", summary: "Văn: T3 13:30–15:00", before: {}, conflicts: 1 }, "c2")).toBe("An sửa học thêm Văn: T3 13:30–15:00 · trùng giờ học ở trường");
    expect(t("schedule.extra.off", { child_id: "c2", summary: "Văn: T3 15:30–17:00" }, "c2")).toBe("An bỏ học thêm Văn: T3 15:30–17:00");
    expect(t("schedule.restore", { child_id: "c2" }, "p")).toBe("Khôi phục lịch học của An về bản trước");
    expect(t("schedule.extras.paste", { child_id: "c1", added: 4, updated: 0, off: 1 }, "p")).toBe("Bố mẹ dán học thêm cho Nguyên: thêm 4, bỏ 1 môn");
  });
});
