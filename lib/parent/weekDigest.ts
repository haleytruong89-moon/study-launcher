/**
 * L-5 "Tổng kết tuần" for the parents (decisions 15–16/11/2026, hub BAO_CAO_PHU_HUYNH_DESIGN_v1.md):
 * one page for both children, read at 20:00 Friday, covering Saturday before → Friday
 * (`reviewPeriod`). Information only: no points, no ranking, no comparison between the
 * children, no AI. PURE: shaping loaded rows into what the page and the Friday push show.
 */
import type { PushMessage } from "@/lib/push/messages";
import { addDays, atLocalTime, isoWeekday, localDate } from "@/lib/time";
import { reviewPeriod } from "@/lib/today/week";

/** A finished task the parents marked "Chưa đạt" during the week. */
export interface NotOkRun {
  /** Homework subject, or the template's subject / title. */
  label: string;
}

/** Homework past its due date (as of the end of the week) and still not done. */
export interface OverdueHomework {
  subject: string;
  dueDate: string;
}

/** The tutor's week, summed from public.learning_cards (SQL 0021). */
export interface TutorWeek {
  minutes: number;
  problems: number;
  selfSolved: number;
  /** "Để dành hỏi thầy" + "chờ thầy xem": what to bring to the human tutor's session. */
  carry: number;
}

export interface SuggestionInput {
  notOk: readonly NotOkRun[];
  overdue: readonly OverdueHomework[];
  tutor: TutorWeek | null;
}

/** "Toán, Văn" with duplicates once, at most 3 names then "…". */
function names(labels: readonly string[]): string {
  const uniq = [...new Set(labels.map((l) => l.trim()).filter((l) => l !== ""))];
  return uniq.length <= 3 ? uniq.join(", ") : `${uniq.slice(0, 3).join(", ")}…`;
}

/**
 * "Gợi ý kèm con cuối tuần" (parent decision 16/11/2026: drawn from the data, never AI):
 * at most 3 short lines, in this order: tasks marked Chưa đạt, homework past due, what to
 * bring to the human tutor. Nothing to suggest → [] (the page says the week went smoothly).
 */
export function weekSuggestions(input: SuggestionInput): string[] {
  const out: string[] = [];
  if (input.notOk.length > 0) {
    out.push(`${input.notOk.length} bài bố mẹ chấm Chưa đạt (${names(input.notOk.map((r) => r.label))}): ngồi xem lại cùng con`);
  }
  if (input.overdue.length > 0) {
    out.push(`${input.overdue.length} bài quá hạn chưa làm (${names(input.overdue.map((h) => h.subject))}): cùng con xếp giờ làm cuối tuần`);
  }
  if (input.tutor && input.tutor.carry > 0) {
    out.push(`${input.tutor.carry} bài con để dành ở gia sư AI: mang sang buổi gia sư`);
  }
  return out.slice(0, 3);
}

/** "14/11 – 20/11" for the week keyed by its Monday. */
export function periodLabel(weekKey: string): string {
  const { from, to } = reviewPeriod(weekKey);
  const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return `${dm(from)} – ${dm(to)}`;
}

/** The card on Hôm nay links to the page from 20:00 Friday to the end of Sunday. */
export const WEEK_CARD_FROM = "20:00";
export function weekCardVisible(now: Date): boolean {
  const today = localDate(now);
  const wd = isoWeekday(today);
  if (wd === 5) return now.getTime() >= atLocalTime(today, WEEK_CARD_FROM).getTime();
  return wd === 6 || wd === 7;
}

/**
 * Which week the page may show: a Monday key, not after `latest` (no future weeks). Anything
 * else (missing, not a Monday, malformed) → `latest`.
 */
export function pickWeek(raw: string | undefined, latest: string): string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return latest;
  if (Number.isNaN(Date.parse(`${raw}T00:00:00Z`)) || isoWeekday(raw) !== 1) return latest;
  return raw > latest ? latest : raw;
}

export const prevWeek = (weekKey: string) => addDays(weekKey, -7);
export const nextWeek = (weekKey: string, latest: string) => (weekKey < latest ? addDays(weekKey, 7) : null);

export interface PushChild {
  name: string;
  okDays: number;
}

/**
 * The Friday push (parent decision 16/11/2026): replaces the daily one, ONE push, sent even
 * when nothing waits. "Tổng kết tuần 14/11 – 20/11" / "Nguyên 5/7 ngày · An 6/7 ngày · còn 2
 * bài chưa xem · chạm để mở". The day's waiting items ride along so nothing is lost.
 */
export function weekPushMessage(weekKey: string, children: readonly PushChild[], waiting: { unreviewed: number; requests: number; tutorLook: number }): PushMessage {
  const parts = children.map((c) => `${c.name} ${c.okDays}/7 ngày`);
  if (waiting.unreviewed > 0) parts.push(`còn ${waiting.unreviewed} bài chưa xem`);
  if (waiting.requests > 0) parts.push(`${waiting.requests} việc con đang nhờ`);
  if (waiting.tutorLook > 0) parts.push(`Gia sư AI: ${waiting.tutorLook} chỗ cần xem`);
  parts.push("chạm để mở");
  return { title: `Tổng kết tuần ${periodLabel(weekKey)}`, body: parts.join(" · "), url: "/parent/week", tag: "week" };
}
