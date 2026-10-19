import { describe, expect, it } from "vitest";
import { computeDayState, type DayInput, type HomeworkItemInput, type TaskTemplateInput } from "@/lib/dayState";
import { childOverview, dueText, machineText, parentPill, type Verdict } from "@/lib/parent/overview";

// Reference day: Wednesday 2026-10-14, 20:00 VN.
const TODAY = "2026-10-14";
const vn = (t: string) => new Date(`${t}+07:00`);
const NOW = vn("2026-10-14T20:00:00");

const SETTINGS = {
  breakMinutes: 10,
  freeMinutes: 45,
  extraMinMinutes: 20,
  skillMinMinutes: 20,
  passesPerWeek: 1,
  trustUpPct: 90,
  trustUpWeeks: 3,
  trustDownPct: 70,
  homeworkLookaheadDays: 1,
  homeworkMinUpcoming: 1,
};

const hw = (id: string, dueDate: string, patch: Partial<HomeworkItemInput> = {}): HomeworkItemInput => ({
  id,
  subject: id,
  dueDate,
  note: null,
  doneAt: null,
  archivedAt: null,
  createdAt: vn("2026-10-10T20:00:00").toISOString(),
  ...patch,
});

const tpl = (id: string, part: "extra" | "skill"): TaskTemplateInput => ({
  id,
  part,
  title: id,
  subject: null,
  appSlotId: null,
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  minMinutes: null,
  deepLink: null,
  sort: 0,
  active: true,
});

function day(patch: Partial<DayInput> = {}): DayInput {
  return {
    settings: SETTINGS,
    bedtime: "22:30:00",
    trustMode: "lock",
    sessions: [],
    homework: [],
    templates: [],
    appSlots: [],
    runs: [],
    overrides: [],
    ...patch,
  };
}

describe("parent overview", () => {
  it("splits overdue / today / upcoming and tags each task", () => {
    const input = day({
      homework: [
        hw("Toán", "2026-10-12"),
        hw("Văn", "2026-10-15", { note: "Phân tích khổ 2" }),
        hw("Anh", "2026-10-15", { doneAt: vn("2026-10-14T19:40:00").toISOString() }),
        hw("KHTN", "2026-10-17"),
        hw("Sử", "2026-10-18"),
        hw("Địa", "2026-10-19"),
        hw("GDCD", "2026-10-20"),
      ],
      templates: [tpl("Luyện đề", "extra"), tpl("Đọc sách", "skill")],
      runs: [
        { id: "r-anh", localDate: TODAY, source: "homework", homeworkItemId: "Anh", templateId: null, startedAt: vn("2026-10-14T19:20:00").toISOString(), doneAt: vn("2026-10-14T19:40:00").toISOString(), proofPaths: ["a.jpg"] },
        { id: "r-van", localDate: TODAY, source: "homework", homeworkItemId: "Văn", templateId: null, startedAt: vn("2026-10-14T19:48:00").toISOString(), doneAt: null, proofPaths: [] },
      ],
    });
    const state = computeDayState(input, NOW);
    const o = childOverview(state, new Map<string, Verdict>(), NOW);

    expect(o.overdue.map((r) => [r.title, r.meta, r.tag.label, r.tag.tone])).toEqual([["Toán", "Hạn 12/10 · trễ 2 ngày", "Chưa làm", "late"]]);
    const titles = o.today.map((r) => r.title);
    expect(titles).toContain("Văn");
    expect(titles).toContain("Bổ sung · Luyện đề");
    expect(titles).toContain("Kỹ năng · Đọc sách");
    expect(o.today.find((r) => r.title === "Văn")).toMatchObject({ meta: "Nộp mai 15/10 · Phân tích khổ 2", tag: { label: "Đang làm 12′", tone: "run" } });
    expect(o.today.find((r) => r.title === "Anh")?.tag).toEqual({ label: "Chờ xem", tone: "wait" });
    expect(o.awaiting).toBe(1);
    expect(o.minutes).toBe(20);

    expect(o.upcoming.map((r) => r.title)).toEqual(["KHTN", "Sử", "Địa"]);
    expect(o.upcomingMore).toBe(1);
  });

  it("a marked task shows the verdict, and no longer waits", () => {
    const input = day({
      homework: [hw("Anh", "2026-10-15", { doneAt: vn("2026-10-14T19:40:00").toISOString() })],
      runs: [{ id: "r1", localDate: TODAY, source: "homework", homeworkItemId: "Anh", templateId: null, startedAt: null, doneAt: vn("2026-10-14T19:40:00").toISOString(), proofPaths: ["a.jpg"] }],
    });
    const state = computeDayState(input, NOW);
    const o = childOverview(state, new Map<string, Verdict>([["r1", "not_ok"]]), NOW);
    expect(o.today[0]?.tag).toEqual({ label: "Chưa đạt", tone: "bad" });
    expect(o.awaiting).toBe(0);
  });

  it("plain words for the status and the laptop", () => {
    const state = computeDayState(day({ templates: [tpl("Luyện đề", "extra")] }), NOW);
    expect(parentPill(state)).toBe("Chưa bắt đầu");
    expect(machineText(state)).toBe("Máy: chỉ trang học");
    expect(machineText({ open: true, openUntil: vn("2026-10-14T22:10:00").toISOString() })).toBe("Máy: mở mọi trang đến 22:10");
    expect(dueText(TODAY, TODAY)).toBe("Nộp hôm nay");
    expect(dueText("2026-10-22", TODAY)).toBe("Nộp 22/10");
  });
});
