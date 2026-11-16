import { describe, expect, it } from "vitest";
import { nextWeek, periodLabel, pickWeek, prevWeek, weekCardVisible, weekPushMessage, weekSuggestions } from "@/lib/parent/weekDigest";

const at = (iso: string) => new Date(iso); // +07:00 offsets below are Vietnam time

describe("L-5 week digest", () => {
  it("period label: Saturday before → Friday", () => {
    expect(periodLabel("2026-11-16")).toBe("14/11 – 20/11");
  });

  it("suggestions: Chưa đạt, then overdue, then tutor carry; at most 3; names once", () => {
    expect(
      weekSuggestions({
        notOk: [{ label: "Toán" }, { label: "Văn" }, { label: "Toán" }],
        overdue: [{ subject: "Anh", dueDate: "2026-11-18" }],
        tutor: { minutes: 50, problems: 4, selfSolved: 0, carry: 2 },
      }),
    ).toEqual([
      "3 bài bố mẹ chấm Chưa đạt (Toán, Văn): ngồi xem lại cùng con",
      "1 bài quá hạn chưa làm (Anh): cùng con xếp giờ làm cuối tuần",
      "2 bài con để dành ở gia sư AI: mang sang buổi gia sư",
    ]);
    expect(weekSuggestions({ notOk: [], overdue: [], tutor: { minutes: 10, problems: 1, selfSolved: 0, carry: 0 } })).toEqual([]);
    expect(weekSuggestions({ notOk: [], overdue: [], tutor: null })).toEqual([]);
  });

  it("suggestions: more than 3 names get an ellipsis", () => {
    const [line] = weekSuggestions({ notOk: ["Toán", "Văn", "Anh", "KHTN"].map((label) => ({ label })), overdue: [], tutor: null });
    expect(line).toBe("4 bài bố mẹ chấm Chưa đạt (Toán, Văn, Anh…): ngồi xem lại cùng con");
  });

  it("card on Hôm nay: Friday from 20:00 to the end of Sunday", () => {
    expect(weekCardVisible(at("2026-11-20T19:59:00+07:00"))).toBe(false);
    expect(weekCardVisible(at("2026-11-20T20:00:00+07:00"))).toBe(true);
    expect(weekCardVisible(at("2026-11-21T08:00:00+07:00"))).toBe(true);
    expect(weekCardVisible(at("2026-11-22T23:59:00+07:00"))).toBe(true);
    expect(weekCardVisible(at("2026-11-23T00:01:00+07:00"))).toBe(false);
    expect(weekCardVisible(at("2026-11-18T21:00:00+07:00"))).toBe(false);
  });

  it("pick week: a Monday not after the latest; anything else → latest", () => {
    expect(pickWeek(undefined, "2026-11-16")).toBe("2026-11-16");
    expect(pickWeek("2026-11-09", "2026-11-16")).toBe("2026-11-09");
    expect(pickWeek("2026-11-23", "2026-11-16")).toBe("2026-11-16");
    expect(pickWeek("2026-11-10", "2026-11-16")).toBe("2026-11-16");
    expect(pickWeek("x", "2026-11-16")).toBe("2026-11-16");
    expect(prevWeek("2026-11-16")).toBe("2026-11-09");
    expect(nextWeek("2026-11-09", "2026-11-16")).toBe("2026-11-16");
    expect(nextWeek("2026-11-16", "2026-11-16")).toBeNull();
  });

  it("Friday push: each child's days + what still waits, always sent, opens the page", () => {
    const m = weekPushMessage("2026-11-16", [{ name: "Nguyên", okDays: 5 }, { name: "An", okDays: 6 }], { unreviewed: 2, requests: 0, tutorLook: 1 });
    expect(m).toEqual({
      title: "Tổng kết tuần 14/11 – 20/11",
      body: "Nguyên 5/7 ngày · An 6/7 ngày · còn 2 bài chưa xem · Gia sư AI: 1 chỗ cần xem · chạm để mở",
      url: "/parent/week",
      tag: "week",
    });
    expect(weekPushMessage("2026-11-16", [{ name: "An", okDays: 7 }], { unreviewed: 0, requests: 0, tutorLook: 0 }).body).toBe("An 7/7 ngày · chạm để mở");
  });
});
