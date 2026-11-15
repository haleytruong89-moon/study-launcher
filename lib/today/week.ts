/**
 * S2e (parent decisions 17/10/2026): the child's day plan, icon and the weekly review.
 * PURE functions, shared by server routes and the screen. Display only: nothing here
 * changes what locks or opens the laptop (computeDayState stays the only source of truth).
 */
import { isDayOk, type DaySessionInput, type DayState, type TaskView } from "@/lib/dayState";
import { addDays, atLocalTime, isoWeekday, localDate, weekStart } from "@/lib/time";
import { runningItems } from "@/lib/today/rules";

// ---------------------------------------------------------------------------
// Icon (a fixed set; no photos of the child are ever stored)
// ---------------------------------------------------------------------------

export const ICONS = [
  "🦊", "🐼", "🐯", "🦁", "🐸", "🐙", "🦉", "🐬", "🐢", "🦄", "🐝", "🐧",
  "⚽", "🏀", "🏸", "🎸", "🎨", "🚀", "🌟", "🌈", "📚", "🧩", "🌻", "🍀",
] as const;

export function isIcon(value: unknown): value is (typeof ICONS)[number] {
  return typeof value === "string" && (ICONS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Day plan ("Kế hoạch hôm nay", optional)
// ---------------------------------------------------------------------------

export const MAX_PLAN_ITEMS = 40;

/** Tasks the child may put in today's plan: everything listed that is not a placeholder. */
export function plannable(state: DayState): TaskView[] {
  return [...state.part1.items, ...state.part2.items].filter((i) => !i.placeholder);
}

/**
 * Cleans a plan sent by the browser: keeps only keys of today's plannable tasks, in the
 * given order, without duplicates. Returns null when nothing valid is left.
 */
export function cleanPlan(state: DayState, keys: string[]): string[] | null {
  const allowed = new Set(plannable(state).map((i) => i.key));
  const out: string[] = [];
  for (const k of keys) if (allowed.has(k) && !out.includes(k)) out.push(k);
  return out.length > 0 ? out.slice(0, MAX_PLAN_ITEMS) : null;
}

/**
 * Next task when the child made a plan: a running task first, then the first planned task
 * still to do (both parts are open, R1). null = plan has nothing left
 * that can start (the screen falls back to the default suggestion).
 */
export function nextFromPlan(state: DayState, plan: string[] | null): TaskView | null {
  if (!plan || plan.length === 0) return null;
  const items = plannable(state);
  // R8a: a running "Làm thêm" run counts as running.
  const running = runningItems(state).find((i) => !i.placeholder);
  if (running) return running;
  const byKey = new Map(items.map((i) => [i.key, i]));
  for (const k of plan) {
    const i = byKey.get(k);
    if (!i || i.state !== "todo") continue;
    return i;
  }
  return null;
}

/** Planned tasks done / planned tasks still listed today. */
export function planProgress(state: DayState, plan: string[]): { done: number; total: number } {
  const byKey = new Map(plannable(state).map((i) => [i.key, i]));
  const listed = plan.map((k) => byKey.get(k)).filter((i): i is TaskView => !!i);
  return { done: listed.filter((i) => i.state === "done").length, total: listed.length };
}

// ---------------------------------------------------------------------------
// Weekly review ("Tổng kết tuần", Friday 17:00 -> end of Saturday)
// ---------------------------------------------------------------------------

export const REVIEW_OPENS_AT = "17:00";

/**
 * Parent decision 15/11/2026: the review moves from Sunday evening to Friday (the parents
 * read it at 20:00 Friday and have the weekend to sit with the children). A review is still
 * keyed by the Monday of its week (`weekly_reviews.week_start`), but it now covers the 7 days
 * ending that Friday: the Saturday before → Friday (`reviewPeriod`), so weekend work counts in
 * the next review.
 */
export function reviewPeriod(weekStartDate: string): { from: string; to: string } {
  return { from: addDays(weekStartDate, -2), to: addDays(weekStartDate, 4) };
}

/**
 * Monday key of the week under review while the review is open, else null:
 * Friday from 17:00 and all of Saturday.
 */
export function reviewWeek(now: Date): string | null {
  const today = localDate(now);
  const wd = isoWeekday(today);
  if (wd === 5) return now.getTime() >= atLocalTime(today, REVIEW_OPENS_AT).getTime() ? weekStart(today) : null;
  if (wd === 6) return weekStart(today);
  return null;
}

/** The latest review the parents can read: the open one, else the one of the last Friday. */
export function latestReviewWeek(now: Date): string {
  const open = reviewWeek(now);
  if (open) return open;
  const today = localDate(now);
  // Sunday: last Friday is in this Monday-week; Monday … Friday before 17:00: in last week.
  return isoWeekday(today) === 7 ? weekStart(today) : addDays(weekStart(today), -7);
}

/** What the weekly review shows (no points, no ranking: information only). */
export interface WeekStats {
  weekStart: string;
  /** Days of the week counted as "đạt" (sick / holiday / pass / both parts before bedtime). */
  okDays: number;
  /** Homework finished >= 2 days early during the week. */
  early: number;
  /** Minutes between start and finish of the week's finished tasks. */
  minutes: number;
  /** Days with a plan, and days where every planned task was done that day. */
  planDays: number;
  planKeptDays: number;
}

export interface WeekStatsInput {
  weekStart: string;
  bedtime: string;
  sessions: DaySessionInput[];
  /** task_runs of the week (any state). */
  runs: { localDate: string; source: "homework" | "template"; homeworkItemId: string | null; templateId: string | null; startedAt: string | null; doneAt: string | null }[];
  /** Homework referenced by the week (done or planned): id, due date, done_at. */
  homework: { id: string; dueDate: string; doneAt: string | null }[];
  plans: { localDate: string; itemKeys: string[] }[];
}

export function weekStats(input: WeekStatsInput): WeekStats {
  const { from } = reviewPeriod(input.weekStart);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const inWeek = (d: string) => d >= days[0]! && d <= days[6]!;

  const okDays = input.sessions.filter((s) => inWeek(s.localDate) && isDayOk(s, input.bedtime)).length;

  const doneDate = (iso: string | null) => (iso ? localDate(new Date(iso)) : null);
  const early = input.homework.filter((h) => {
    const d = doneDate(h.doneAt);
    return d !== null && inWeek(d) && d <= addDays(h.dueDate, -2);
  }).length;

  let minutes = 0;
  for (const r of input.runs) {
    if (!inWeek(r.localDate) || !r.startedAt || !r.doneAt) continue;
    minutes += Math.max(0, Math.round((new Date(r.doneAt).getTime() - new Date(r.startedAt).getTime()) / 60_000));
  }

  const hwDone = new Map(input.homework.map((h) => [h.id, doneDate(h.doneAt)]));
  let planDays = 0;
  let planKeptDays = 0;
  for (const p of input.plans) {
    if (!inWeek(p.localDate) || p.itemKeys.length === 0) continue;
    planDays++;
    const kept = p.itemKeys.every((key) => {
      const [kind, id] = key.split(":");
      if (kind === "homework") {
        const d = hwDone.get(id ?? "");
        return d !== null && d !== undefined && d <= p.localDate;
      }
      return input.runs.some((r) => r.source === "template" && r.templateId === id && r.localDate === p.localDate && r.doneAt !== null);
    });
    if (kept) planKeptDays++;
  }

  return { weekStart: input.weekStart, okDays, early, minutes, planDays, planKeptDays };
}

/** "2 giờ 10 phút" / "45 phút". */
export function hoursMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} phút`;
  return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
}

export const REVIEW_QUESTIONS = {
  wentWell: "Tuần này con làm tốt điều gì?",
  changeNext: "Tuần sau con muốn đổi 1 điều gì?",
} as const;
