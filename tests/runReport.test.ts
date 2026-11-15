import { describe, expect, it } from "vitest";
import { computeDayState, type DayInput, type TaskRunInput } from "@/lib/dayState";
import { runReportMessage } from "@/lib/push/messages";
import {
  canReport,
  clockMinutes,
  decideReport,
  decideReportAnswer,
  defaultReportTimes,
  MAX_REPORTS_PER_DAY,
  reportMinutes,
  reportNote,
  reportRange,
  type RunReport,
} from "@/lib/today/report";
import { allItems } from "@/lib/today/rules";

// "Con quên bấm Bắt đầu?" (parent decision 15/11/2026, SQL 0020). Wednesday 2026-10-14, VN time.
const TODAY = "2026-10-14";
const vn = (t: string) => new Date(`${TODAY}T${t}+07:00`);
const at = (t: string) => vn(t).toISOString();

const EXTRA = "22222222-2222-4222-8222-222222222222";
const SKILL = "33333333-3333-4333-8333-333333333333";
const OTHER = "44444444-4444-4444-8444-444444444444";
const CAP = 180;

function day(patch: Partial<DayInput> = {}): DayInput {
  return {
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
      homeworkMinUpcoming: 1,
    },
    bedtime: "21:30",
    trustMode: "lock",
    sessions: [],
    homework: [],
    templates: [
      { id: EXTRA, part: "extra", title: "Toán bổ sung", subject: "Toán", appSlotId: null, weekdays: [3], minMinutes: null, deepLink: null, sort: 0, active: true },
      { id: SKILL, part: "skill", title: "Tiếng Anh", subject: null, appSlotId: null, weekdays: [3], minMinutes: 20, deepLink: "https://english.example.com", sort: 0, active: true },
      { id: OTHER, part: "skill", title: "Đọc sách", subject: null, appSlotId: null, weekdays: [4], minMinutes: 20, deepLink: null, sort: 1, active: true },
    ],
    appSlots: [],
    runs: [],
    overrides: [],
    breaks: [],
    ...patch,
  };
}

const run = (id: string, templateId: string, startedAt: string, doneAt: string | null): TaskRunInput => ({
  id,
  localDate: TODAY,
  source: "template",
  homeworkItemId: null,
  templateId,
  startedAt,
  doneAt,
  proofPaths: [],
});

const report = (patch: Partial<RunReport> = {}): RunReport => ({
  id: "r1",
  templateId: SKILL,
  localDate: TODAY,
  startedAt: at("15:10"),
  endedAt: at("15:40"),
  status: "pending",
  ...patch,
});

const NOW = vn("16:00");
const state = (patch: Partial<DayInput> = {}, now = NOW) => computeDayState(day(patch), now);
const ask = (from: string, to: string, templateId = SKILL) => ({ templateId, from, to });

describe("decideReport (child: Con quên bấm Bắt đầu?)", () => {
  it("stores a 30' report of today's skill on today's date (VN), server clock", () => {
    const d = decideReport(state(), [], ask("15:10", "15:40"), NOW, CAP);
    expect(d).toMatchObject({ ok: true, value: { startedAt: at("15:10"), endedAt: at("15:40"), minutes: 30 } });
    if (d.ok) expect(d.value.item.id).toBe(SKILL);
  });

  it("only a task of today's list: unknown, another weekday's, or homework is refused", () => {
    expect(decideReport(state(), [], ask("15:10", "15:40", "99999999-9999-4999-8999-999999999999"), NOW, CAP)).toMatchObject({ ok: false, status: 404 });
    expect(decideReport(state(), [], ask("15:10", "15:40", OTHER), NOW, CAP)).toMatchObject({ ok: false, status: 404 });
    const off = day({ sessions: [{ localDate: TODAY, dayType: "normal", disabledTemplateIds: [SKILL], breakStartedAt: null, breakEndedAt: null, breakSkipped: false, part1DoneAt: null, part2DoneAt: null, freeStartedAt: null, passUsedAt: null }] });
    expect(decideReport(computeDayState(off, NOW), [], ask("15:10", "15:40"), NOW, CAP)).toMatchObject({ ok: false, status: 404 });
    const inactive = day({ templates: day().templates.map((t) => (t.id === SKILL ? { ...t, active: false } : t)) });
    expect(decideReport(computeDayState(inactive, NOW), [], ask("15:10", "15:40"), NOW, CAP)).toMatchObject({ ok: false, status: 404 });
  });

  it("not when the task is done or running (also a Làm thêm run)", () => {
    const done = state({ runs: [run("a", SKILL, at("14:00"), at("14:30"))] });
    expect(decideReport(done, [], ask("15:10", "15:40"), NOW, CAP)).toMatchObject({ ok: false, status: 409, error: "Việc này đã xong rồi." });
    const running = state({ runs: [run("a", SKILL, at("15:50"), null)] });
    expect(decideReport(running, [], ask("15:10", "15:40"), NOW, CAP)).toMatchObject({ ok: false, status: 409 });
  });

  it("times: HH:MM, end after start, end not after the server clock (+1 minute)", () => {
    expect(decideReport(state(), [], ask("3:10", "15:40"), NOW, CAP)).toMatchObject({ ok: false, status: 400 });
    expect(decideReport(state(), [], ask("15:40", "15:10"), NOW, CAP)).toMatchObject({ ok: false, status: 400 });
    expect(decideReport(state(), [], ask("15:40", "15:40"), NOW, CAP)).toMatchObject({ ok: false, status: 400 });
    expect(decideReport(state(), [], ask("15:31", "16:01"), NOW, CAP)).toMatchObject({ ok: true }); // 1 minute of skew
    expect(decideReport(state(), [], ask("15:32", "16:02"), NOW, CAP)).toMatchObject({ ok: false, status: 409 });
    expect(decideReport(state(), [], ask("00:00", "00:30"), NOW, CAP)).toMatchObject({ ok: true, value: { startedAt: new Date(`${TODAY}T00:00:00+07:00`).toISOString() } });
  });

  it("length: at least the task's minimum (≥ 1'), at most the family cap", () => {
    expect(decideReport(state(), [], ask("15:30", "15:49"), NOW, CAP)).toMatchObject({ ok: false, status: 409, error: "Việc này cần ít nhất 20 phút." });
    expect(decideReport(state(), [], ask("15:30", "15:50"), NOW, CAP)).toMatchObject({ ok: true, value: { minutes: 20 } });
    // A task with no minimum still needs one minute.
    const untimed = state({ templates: day().templates.map((t) => (t.id === SKILL ? { ...t, minMinutes: 0 } : t)) });
    expect(decideReport(untimed, [], ask("15:30", "15:31"), NOW, CAP)).toMatchObject({ ok: true, value: { minutes: 1 } });
    expect(decideReport(state(), [], ask("12:59", "16:00"), NOW, CAP)).toMatchObject({ ok: false, status: 409, error: "Một lượt tối đa 180 phút." });
    expect(decideReport(state(), [], ask("13:00", "16:00"), NOW, CAP)).toMatchObject({ ok: true, value: { minutes: 180 } });
    expect(decideReport(state(), [], ask("15:00", "16:00"), NOW, 45)).toMatchObject({ ok: false, error: "Một lượt tối đa 45 phút." });
  });

  it(`at most ${MAX_REPORTS_PER_DAY} reports a day (pending, approved, rejected all count); one pending per task`, () => {
    expect(decideReport(state(), [report({ id: "x", templateId: EXTRA, status: "rejected" })], ask("15:10", "15:40"), NOW, CAP)).toMatchObject({ ok: true });
    const two = [report({ id: "x", templateId: EXTRA, status: "rejected" }), report({ id: "y", templateId: EXTRA, status: "approved" })];
    expect(decideReport(state(), two, ask("15:10", "15:40"), NOW, CAP)).toMatchObject({ ok: false, status: 409, error: "Hôm nay con đã nhờ đủ 2 lần rồi." });
    expect(decideReport(state(), [report()], ask("14:00", "14:30"), NOW, CAP)).toMatchObject({ ok: false, status: 409, error: "Lượt trước của việc này đang chờ bố mẹ xác nhận." });
    // Another day's rows never count.
    const old = [report({ localDate: "2026-10-13" }), report({ id: "z", localDate: "2026-10-13" })];
    expect(decideReport(state(), old, ask("15:10", "15:40"), NOW, CAP)).toMatchObject({ ok: true });
  });

  it("a pending report changes nothing in the day state (it is not a run)", () => {
    const before = state();
    const d = decideReport(before, [], ask("15:10", "15:40"), NOW, CAP);
    expect(d.ok).toBe(true);
    const after = state(); // the loader never turns a report into a run
    expect(after).toEqual(before);
    expect(allItems(after).find((i) => i.id === SKILL)?.state).toBe("todo");
  });
});

describe("approved report = a normal finished run (computeDayState)", () => {
  // The exact row POST /api/admin/run-reports/[id] inserts on Đồng ý.
  const approved = (from: string, to: string, id = "rep-run") => run(id, SKILL, at(from), at(to));

  it("≥ the minimum: the skill is done; with the extra done too Part 2 / free time follow as for any run", () => {
    const s = state({ runs: [approved("15:10", "15:40")] });
    const item = allItems(s).find((i) => i.id === SKILL);
    expect(item).toMatchObject({ state: "done", doneAt: at("15:40"), todayMinutes: 30, sessions: 1 });
    expect(s.part2.complete).toBe(true);
  });

  it("counts for the break bank (R8b: finished runs only, each ≤ the cap)", () => {
    // Only the reported run (the extra is not done, so no free time yet): 50' of focus → 10'.
    const s = state({ runs: [approved("14:50", "15:40")] }, vn("15:41"));
    expect(s.break).toMatchObject({ bankMinutes: 10, canStart: true });
    // A pending report is not a run: no bank.
    expect(state({}, vn("15:41")).break.bankMinutes).toBe(0);
    const capped = state({ runs: [approved("10:00", "13:00")] }, vn("13:01"));
    expect(capped.break.bankMinutes).toBe(60); // 180' → 60'
  });

  it("approved after the task was done another way: an extra run (R8a), nothing else changes", () => {
    const first = run("a", SKILL, at("14:00"), at("14:25"));
    const before = state({ runs: [first] }, vn("16:00"));
    const after = state({ runs: [first, approved("15:00", "15:30")] }, vn("16:00"));
    const b = allItems(before).find((i) => i.id === SKILL);
    const a = allItems(after).find((i) => i.id === SKILL);
    expect(a).toMatchObject({ state: "done", doneAt: b?.doneAt, sessions: 2, extra: null });
    expect([after.part2.complete, after.part2.doneAt]).toEqual([before.part2.complete, before.part2.doneAt]);
  });
});

describe("decideReportAnswer (parent)", () => {
  const now = vn("16:00");
  it("decides a pending report of today", () => {
    expect(decideReportAnswer({ localDate: TODAY, status: "pending" }, "approve", now)).toEqual({ ok: true, value: { write: true } });
    expect(decideReportAnswer({ localDate: TODAY, status: "pending" }, "reject", now)).toEqual({ ok: true, value: { write: true } });
  });
  it("idempotent: the same answer again writes nothing; another answer is refused", () => {
    expect(decideReportAnswer({ localDate: TODAY, status: "approved" }, "approve", now)).toEqual({ ok: true, value: { write: false } });
    expect(decideReportAnswer({ localDate: TODAY, status: "rejected" }, "reject", now)).toEqual({ ok: true, value: { write: false } });
    expect(decideReportAnswer({ localDate: TODAY, status: "approved" }, "reject", now)).toMatchObject({ ok: false, status: 409 });
    expect(decideReportAnswer({ localDate: TODAY, status: "rejected" }, "approve", now)).toMatchObject({ ok: false, status: 409 });
  });
  it("approve only on the report's own day; Không đúng any day", () => {
    expect(decideReportAnswer({ localDate: "2026-10-13", status: "pending" }, "approve", now)).toMatchObject({ ok: false, status: 409, error: "Yêu cầu này đã qua ngày." });
    expect(decideReportAnswer({ localDate: "2026-10-13", status: "pending" }, "reject", now)).toEqual({ ok: true, value: { write: true } });
  });
});

describe("child screen helpers", () => {
  const skill = () => allItems(state()).find((i) => i.id === SKILL)!;
  it("offers the link on a not-started template, not with a pending one or at the daily limit", () => {
    expect(canReport(skill(), [])).toBe(true);
    expect(canReport(skill(), [report()])).toBe(false);
    expect(canReport(skill(), [report({ templateId: EXTRA, status: "rejected" })])).toBe(true);
    expect(canReport(skill(), [report({ id: "a", templateId: EXTRA, status: "rejected" }), report({ id: "b", templateId: EXTRA, status: "approved" })])).toBe(false);
    const running = allItems(state({ runs: [run("a", SKILL, at("15:50"), null)] })).find((i) => i.id === SKILL)!;
    expect(canReport(running, [])).toBe(false);
  });
  it("shows “Đang chờ …” for a pending one and a calm line after Không đúng", () => {
    expect(reportNote(skill(), [report()])).toEqual({ kind: "pending", range: "15:10–15:40" });
    expect(reportNote(skill(), [report({ status: "rejected" })])).toEqual({ kind: "rejected", range: "15:10–15:40" });
    expect(reportNote(skill(), [report({ status: "approved" })])).toBeNull();
    expect(reportNote(skill(), [])).toBeNull();
  });
  it("sheet defaults: the last 30 minutes, never before 00:00; minutes preview", () => {
    expect(defaultReportTimes(vn("15:40").getTime())).toEqual({ from: "15:10", to: "15:40" });
    expect(defaultReportTimes(vn("00:10").getTime())).toEqual({ from: "00:00", to: "00:10" });
    expect(clockMinutes("15:10", "15:40")).toBe(30);
    expect(clockMinutes("15:40", "15:10")).toBeNull();
    expect(clockMinutes("x", "15:10")).toBeNull();
    expect(reportMinutes(at("15:10"), at("15:40"))).toBe(30);
    expect(reportRange({ startedAt: at("15:10"), endedAt: at("15:40") })).toBe("15:10–15:40");
  });
  it("push to the parents: who, which task, when, how long — opens the Con nhờ section", () => {
    expect(runReportMessage("An", "Tiếng Anh", "15:10–15:40", 30)).toEqual({
      title: "An nhờ xác nhận: Tiếng Anh 15:10–15:40 (30 phút)",
      body: "Con quên bấm Bắt đầu · chạm để xác nhận",
      url: "/parent/requests#quen-bam",
      tag: "run-report",
    });
  });
});
