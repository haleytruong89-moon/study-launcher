/**
 * "Lịch của con" step 1 (parent decision 14/11/2026): a READ-ONLY calendar in Góc học tập.
 * PURE and client-safe: date maths, range clamping and the per-date builder. The rows are read
 * by lib/today/calendarServer.ts with the child's own session (RLS); nothing here can change a
 * task, the lock or a day. No ✓, no done counts, no percentages, no streaks (decision 17/10).
 *
 * Data rules (mirroring today's lists, never a second rule set):
 * - homework: not archived, and not done before today (exactly the Today screen's filter in
 *   `homeworkViews`), listed on its due date, ordered by due date, creation, id;
 * - skills: the supplementary (Part 1) then skill (Part 2) templates the child would get that
 *   date — `scheduledTemplates` (active, ISO weekday 1 = Monday ... 7 = Sunday, minus that date's
 *   day_sessions.disabled_template_ids), placeholder app slots ("Đang xây") left out as in
 *   Góc học tập's list;
 * - dayType: day_sessions.day_type of that date (no row = a normal day).
 */
import { scheduledTemplates, type AppSlotInput, type DayType, type TaskTemplateInput } from "@/lib/dayState";
import { addDays, isoWeekday, localDate, weekStart } from "@/lib/time";
import { dayMonth } from "./view";

/** At most this many dates in one answer (two months). */
export const CALENDAR_MAX_DAYS = 62;
/** The earliest date that can be read, in days before today (server clock). */
export const CALENDAR_BACK_DAYS = 31;
/** The latest date that can be read, in days after today. */
export const CALENDAR_AHEAD_DAYS = 93;
/** The month view goes from this month to this many months ahead (no earlier month). */
export const CALENDAR_MONTHS_AHEAD = 2;

export interface CalendarHomework {
  id: string;
  /** The subject (what the Today list shows as the title). */
  title: string;
  subject: string;
  note: string | null;
}

export interface CalendarSkill {
  id: string;
  title: string;
  /** extra = bài bổ sung (Part 1), skill = kỹ năng (Part 2). */
  part: "extra" | "skill";
}

export interface CalendarDay {
  date: string;
  dayType: DayType;
  homework: CalendarHomework[];
  skills: CalendarSkill[];
}

export interface CalendarView {
  /** Today by the server clock (Asia/Ho_Chi_Minh). */
  today: string;
  from: string;
  to: string;
  /** Every date from `from` to `to`, in order. */
  days: CalendarDay[];
}

export interface CalendarHomeworkRow {
  id: string;
  subject: string;
  due_date: string;
  note: string | null;
  done_at: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface CalendarSessionRow {
  local_date: string;
  day_type: DayType;
  disabled_template_ids: string[] | null;
}

export interface CalendarRows {
  homework: CalendarHomeworkRow[];
  sessions: CalendarSessionRow[];
  templates: TaskTemplateInput[];
  slots: Pick<AppSlotInput, "id" | "kind">[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date written YYYY-MM-DD. */
export function isLocalDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Number of days from `a` to `b` (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * The range a request may read: inside today − 31 … today + 93 and at most 62 dates. Missing
 * ends default to this week (Monday … Sunday). Null when a date is malformed or nothing is left.
 */
export function clampRange(from: string | null, to: string | null, today: string): { from: string; to: string } | null {
  const monday = weekStart(today);
  const f0 = from ?? monday;
  const t0 = to ?? (from === null ? addDays(monday, 6) : f0);
  if (!isLocalDate(f0) || !isLocalDate(t0)) return null;
  const lo = addDays(today, -CALENDAR_BACK_DAYS);
  const hi = addDays(today, CALENDAR_AHEAD_DAYS);
  const f = f0 < lo ? lo : f0;
  let t = t0 > hi ? hi : t0;
  if (daysBetween(f, t) > CALENDAR_MAX_DAYS - 1) t = addDays(f, CALENDAR_MAX_DAYS - 1);
  return f <= t ? { from: f, to: t } : null;
}

/** Monday … Sunday of the week containing `date`. */
export function weekDates(date: string): string[] {
  const monday = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** "YYYY-MM" of a date. */
export const monthOf = (date: string): string => date.slice(0, 7);

/** "YYYY-MM" shifted by whole months. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const n = y * 12 + (m - 1) + by;
  return `${String(Math.floor(n / 12)).padStart(4, "0")}-${String((n % 12) + 1).padStart(2, "0")}`;
}

/** Months from `base` to `month` (both "YYYY-MM"). */
export function monthsBetween(base: string, month: string): number {
  const [by, bm] = base.split("-").map(Number) as [number, number];
  const [y, m] = month.split("-").map(Number) as [number, number];
  return (y - by) * 12 + (m - bm);
}

/** First and last date of a month. */
export function monthRange(month: string): { from: string; to: string } {
  const from = `${month}-01`;
  return { from, to: addDays(`${shiftMonth(month, 1)}-01`, -1) };
}

/** The month as weeks of 7 cells, Monday first; cells of other months are null. */
export function monthGrid(month: string): (string | null)[][] {
  const { from, to } = monthRange(month);
  const weeks: (string | null)[][] = [];
  for (let monday = weekStart(from); monday <= to; monday = addDays(monday, 7)) {
    weeks.push(weekDates(monday).map((d) => (monthOf(d) === month ? d : null)));
  }
  return weeks;
}

/** "Tháng 11/2026" */
export function monthTitle(month: string): string {
  return `Tháng ${Number(month.slice(5, 7))}/${month.slice(0, 4)}`;
}

/** What the range for the month view at `offset` months from today's month is (0 … +2). */
export function monthViewRange(today: string, offset: number): { month: string; from: string; to: string } {
  const month = shiftMonth(monthOf(today), Math.min(Math.max(0, Math.trunc(offset)), CALENDAR_MONTHS_AHEAD));
  return { month, ...monthRange(month) };
}

/** Week ∪ current month, so the first view needs one request (≤ 37 dates). */
export function firstRange(today: string): { from: string; to: string } {
  const week = weekDates(today);
  const month = monthRange(monthOf(today));
  const from = (week[0] as string) < month.from ? (week[0] as string) : month.from;
  const to = (week[6] as string) > month.to ? (week[6] as string) : month.to;
  return { from, to };
}

/** The short label of a special day (null on a normal day). */
export function dayTypeLabel(dayType: DayType): string | null {
  switch (dayType) {
    case "exam":
      return "Kiểm tra";
    case "holiday":
      return "Nghỉ lễ";
    case "sick":
      return "Ngày ốm";
    default:
      return null;
  }
}

/** Number of things on a day (homework due + scheduled tasks); never a done count. */
export const dayCount = (d: CalendarDay): number => d.homework.length + d.skills.length;

/** "Thứ Tư 12/11: 2 việc" (+ ", Kiểm tra" on a special day; "không có việc" when empty). */
export function dayAria(d: CalendarDay, today: string): string {
  const n = dayCount(d);
  const parts = [n === 0 ? "không có việc" : `${n} việc`];
  const label = dayTypeLabel(d.dayType);
  if (label) parts.push(label);
  return `${d.date === today ? "Hôm nay, " : ""}${dayMonth(d.date)}: ${parts.join(", ")}`;
}

/** An empty normal day (a date the answer does not cover yet). */
export const emptyDay = (date: string): CalendarDay => ({ date, dayType: "normal", homework: [], skills: [] });

/** Builds every date of the range from the child's rows. */
export function buildCalendar(range: { from: string; to: string }, today: string, rows: CalendarRows): CalendarView {
  const placeholders = new Set(rows.slots.filter((s) => s.kind === "placeholder").map((s) => s.id));
  const sessions = new Map(rows.sessions.map((s) => [s.local_date, s]));
  const homework = rows.homework
    .filter((h) => h.archived_at === null && (h.done_at === null || localDate(new Date(h.done_at)) === today))
    .filter((h) => h.due_date >= range.from && h.due_date <= range.to)
    .sort((a, b) => {
      if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
      const ca = Date.parse(a.created_at);
      const cb = Date.parse(b.created_at);
      if (ca !== cb) return ca - cb;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  const byDue = new Map<string, CalendarHomework[]>();
  for (const h of homework) {
    const list = byDue.get(h.due_date) ?? [];
    list.push({ id: h.id, title: h.subject, subject: h.subject, note: h.note });
    byDue.set(h.due_date, list);
  }

  const days: CalendarDay[] = [];
  for (let date = range.from; date <= range.to; date = addDays(date, 1)) {
    const session = sessions.get(date);
    const disabled = new Set(session?.disabled_template_ids ?? []);
    const weekday = isoWeekday(date);
    const skills = (["extra", "skill"] as const).flatMap((part) =>
      scheduledTemplates(rows.templates, part, weekday, disabled)
        .filter((t) => t.appSlotId === null || !placeholders.has(t.appSlotId))
        .map((t): CalendarSkill => ({ id: t.id, title: t.title, part })),
    );
    days.push({ date, dayType: session?.day_type ?? "normal", homework: byDue.get(date) ?? [], skills });
  }
  return { today, from: range.from, to: range.to, days };
}
