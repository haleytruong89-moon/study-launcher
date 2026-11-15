/**
 * "Con quên bấm Bắt đầu?" (parent decision 15/11/2026, SQL 0020). The child studied a
 * supplementary task or skill without pressing Bắt đầu and tells the parents when. PURE: the
 * routes pass the day state (server data, server clock) and today's reports; nothing the browser
 * claims about time is trusted except the two wall-clock times the child typed, which are read
 * on TODAY's date in Asia/Ho_Chi_Minh and checked against the server clock.
 *
 * A report counts for NOTHING until a parent presses Đồng ý: then the server inserts a normal
 * finished task_runs row (the same shape a Bắt đầu → Xong makes), so completion and the break
 * bank (R8b) follow from computeDayState like for any run. Display only otherwise.
 */
import type { DayState, TaskView } from "@/lib/dayState";
import { atLocalTime, localDate, startOfLocalDay } from "@/lib/time";
import { vnTime } from "@/lib/today/view";
import { allItems, extraRunView, type Decision } from "./rules";

/** At most this many reports per child per day, whatever their answer (parent decision 15/11/2026). */
export const MAX_REPORTS_PER_DAY = 2;
/** The end may be this far after the server clock (a laptop a little ahead, a slow tap). */
export const REPORT_SKEW_MS = 60_000;
/** The sheet's default: "from 30 minutes ago to now". */
export const REPORT_DEFAULT_MINUTES = 30;

export type ReportStatus = "pending" | "approved" | "rejected";

/** One task_run_reports row of today, as the child's screen and the rules need it. */
export interface RunReport {
  id: string;
  templateId: string;
  localDate: string;
  startedAt: string;
  endedAt: string;
  status: ReportStatus;
}

/** "HH:MM", 00:00–23:59. */
export const CLOCK_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const deny = (status: number, error: string): { ok: false; status: number; error: string } => ({ ok: false, status, error });

/** Whole minutes between two instants (the report's length). */
export function reportMinutes(startedAt: string, endedAt: string): number {
  return Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 60_000);
}

/** "15:10–15:40" (Vietnam time). */
export function reportRange(r: { startedAt: string; endedAt: string }): string {
  return `${vnTime(r.startedAt)}–${vnTime(r.endedAt)}`;
}

/**
 * The child's report: may it be stored? `from` / `to` are "HH:MM" on today's date (VN).
 * Rules: the task is today's supplementary task or skill (active, scheduled today, not turned off:
 * it is in the day state), not done, not running; start >= today 00:00 VN; end <= server now
 * (+1 minute); the length is at least the task's minimum (at least 1 minute) and at most
 * `capMinutes` (family_settings.break_run_cap_minutes); at most MAX_REPORTS_PER_DAY reports today
 * (pending, approved and rejected all count); no other pending report for the same task today.
 *
 * Interpretation (15/11/2026): the length must reach the task's minimum, because an approved
 * report becomes a FINISHED run and every finished run counts as done — a shorter one would
 * finish the task with less than the minimum, which a timed run never can.
 */
export function decideReport(
  state: DayState,
  reports: readonly RunReport[],
  input: { templateId: string; from: string; to: string },
  now: Date,
  capMinutes: number,
): Decision<{ item: TaskView; startedAt: string; endedAt: string; minutes: number }> {
  const item = allItems(state).find((i) => i.source === "template" && i.id === input.templateId);
  if (!item) return deny(404, "Không có việc này hôm nay.");
  if (item.state === "placeholder") return deny(409, "App này đang xây, chưa làm được.");
  if (item.state === "running" || extraRunView(item) !== null) return deny(409, "Việc này đang chạy — làm xong thì bấm Xong.");
  if (item.state === "done") return deny(409, "Việc này đã xong rồi.");
  if (!CLOCK_RE.test(input.from) || !CLOCK_RE.test(input.to)) return deny(400, "Giờ chưa đúng (giờ:phút).");

  const today = state.localDate;
  if (localDate(now) !== today) return deny(409, "Đã sang ngày mới, con tải lại trang nhé.");
  const start = atLocalTime(today, input.from);
  const end = atLocalTime(today, input.to);
  if (start.getTime() < startOfLocalDay(today).getTime()) return deny(400, "Chỉ nhờ cho lượt làm hôm nay.");
  if (end.getTime() <= start.getTime()) return deny(400, "Giờ kết thúc phải sau giờ bắt đầu.");
  if (end.getTime() > now.getTime() + REPORT_SKEW_MS) return deny(409, "Giờ kết thúc chưa tới — con chọn giờ đã làm xong.");
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  const min = Math.max(1, item.minMinutes);
  if (minutes < min) return deny(409, `Việc này cần ít nhất ${min} phút.`);
  if (minutes > capMinutes) return deny(409, `Một lượt tối đa ${capMinutes} phút.`);

  const mine = reports.filter((r) => r.localDate === today);
  if (mine.some((r) => r.templateId === item.id && r.status === "pending")) return deny(409, "Lượt trước của việc này đang chờ bố mẹ xác nhận.");
  if (mine.length >= MAX_REPORTS_PER_DAY) return deny(409, `Hôm nay con đã nhờ đủ ${MAX_REPORTS_PER_DAY} lần rồi.`);
  return { ok: true, value: { item, startedAt: start.toISOString(), endedAt: end.toISOString(), minutes } };
}

export type ReportDecision = "approve" | "reject";

/**
 * The parent's answer. Only a pending report is decided; the same answer again is idempotent
 * (`write: false`), a different one is refused. Approve only on the report's own day (VN): the
 * run belongs to that day. "Không đúng" works on any day (it changes nothing that counts).
 */
export function decideReportAnswer(report: { localDate: string; status: ReportStatus }, decision: ReportDecision, now: Date): Decision<{ write: boolean }> {
  const target: ReportStatus = decision === "approve" ? "approved" : "rejected";
  if (report.status === target) return { ok: true, value: { write: false } };
  if (report.status !== "pending") return deny(409, "Yêu cầu này đã được trả lời rồi.");
  if (decision === "approve" && report.localDate !== localDate(now)) return deny(409, "Yêu cầu này đã qua ngày.");
  return { ok: true, value: { write: true } };
}

/** What the child's task shows about its reports today (display only). */
export type ReportNote = { kind: "pending" | "rejected"; range: string } | null;

export function reportNote(item: TaskView, reports: readonly RunReport[]): ReportNote {
  if (item.source !== "template") return null;
  const mine = reports.filter((r) => r.templateId === item.id);
  const pending = mine.find((r) => r.status === "pending");
  if (pending) return { kind: "pending", range: reportRange(pending) };
  if (item.state === "done") return null;
  const last = [...mine].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
  return last?.status === "rejected" ? { kind: "rejected", range: reportRange(last) } : null;
}

/**
 * Whether "Con quên bấm Bắt đầu?" is offered on a task: today's supplementary task or skill, not
 * done, nothing running for it, no pending report for it, fewer than MAX_REPORTS_PER_DAY today.
 * The server checks everything again (decideReport).
 */
export function canReport(item: TaskView, reports: readonly RunReport[]): boolean {
  if (item.source !== "template" || item.state !== "todo" || item.placeholder) return false;
  if (reports.length >= MAX_REPORTS_PER_DAY) return false;
  return !reports.some((r) => r.templateId === item.id && r.status === "pending");
}

/** The sheet's default times: now − 30' → now (VN, server clock), never before 00:00. */
export function defaultReportTimes(nowMs: number): { from: string; to: string } {
  const to = vnTime(new Date(nowMs).toISOString());
  const dayStart = startOfLocalDay(localDate(new Date(nowMs))).getTime();
  const from = vnTime(new Date(Math.max(dayStart, nowMs - REPORT_DEFAULT_MINUTES * 60_000)).toISOString());
  return { from, to };
}

/** Minutes between two "HH:MM" on the same day (the sheet's preview); null when not valid. */
export function clockMinutes(from: string, to: string): number | null {
  if (!CLOCK_RE.test(from) || !CLOCK_RE.test(to)) return null;
  const m = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const d = m(to) - m(from);
  return d > 0 ? d : null;
}
