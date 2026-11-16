import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChildSummary } from "@/lib/admin/page";
import { reviewPeriod, type WeekStats } from "@/lib/today/week";
import { loadWeekStats, loadWeeklyReview, type WeeklyReview } from "@/lib/today/week-load";
import { weekSuggestions, type NotOkRun, type OverdueHomework, type TutorWeek } from "./weekDigest";

export interface ChildWeek {
  child: ChildSummary;
  /** null when the numbers could not be read (the block says so; the rest still shows). */
  stats: WeekStats | null;
  review: WeeklyReview | null;
  tutor: TutorWeek | null;
  pendingRules: number;
  suggestions: string[];
}

/**
 * L-5: one child's week for the parents' "Tổng kết tuần" (Saturday before → Friday of `weekKey`).
 * `db` is the parent's own session, so RLS bounds every read to the family. Each part fails on
 * its own: a read error hides that part, never the page.
 */
export async function loadChildWeek(db: SupabaseClient, child: ChildSummary, weekKey: string, today: string): Promise<ChildWeek> {
  const { from, to } = reviewPeriod(weekKey);
  const overdueBefore = today <= to ? today : to;
  const soft = async <T,>(what: string, run: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await run();
    } catch (e) {
      console.error(`week digest: ${what} failed`, e instanceof Error ? e.message : e);
      return fallback;
    }
  };

  const [stats, review, notOkRes, overdueRes, cardsRes, rulesRes] = await Promise.all([
    soft("stats", () => loadWeekStats(db, child.id, weekKey, child.bedtime ?? "21:30"), null),
    soft("review", () => loadWeeklyReview(db, child.id, weekKey), null),
    db.from("task_runs").select("homework_items(subject), task_templates(title, subject)").eq("child_id", child.id).gte("local_date", from).lte("local_date", to).eq("parent_verdict", "not_ok"),
    db.from("homework_items").select("subject, due_date").eq("child_id", child.id).is("done_at", null).is("archived_at", null).lt("due_date", overdueBefore).order("due_date"),
    db.from("learning_cards").select("minutes, problems, self_solved, saved_for_later, pending_review").eq("child_id", child.id).gte("local_date", from).lte("local_date", to),
    db.from("learning_pending_rules").select("pending").eq("child_id", child.id),
  ]);

  type Joined = { homework_items: { subject: string } | null; task_templates: { title: string; subject: string | null } | null };
  const notOk: NotOkRun[] = notOkRes.error
    ? []
    : ((notOkRes.data ?? []) as unknown as Joined[]).map((r) => ({ label: r.homework_items?.subject ?? r.task_templates?.subject ?? r.task_templates?.title ?? "Bài" }));
  const overdue: OverdueHomework[] = overdueRes.error ? [] : ((overdueRes.data ?? []) as { subject: string; due_date: string }[]).map((h) => ({ subject: h.subject, dueDate: h.due_date }));

  let tutor: TutorWeek | null = null;
  if (!cardsRes.error && (cardsRes.data ?? []).length > 0) {
    tutor = { minutes: 0, problems: 0, selfSolved: 0, carry: 0 };
    for (const c of cardsRes.data as { minutes: number; problems: number; self_solved: number; saved_for_later: number; pending_review: number }[]) {
      tutor.minutes += Math.max(0, c.minutes);
      tutor.problems += c.problems;
      tutor.selfSolved += c.self_solved;
      tutor.carry += c.saved_for_later + c.pending_review;
    }
  }
  const pendingRules = rulesRes.error ? 0 : ((rulesRes.data ?? []) as { pending: number }[]).reduce((n, r) => n + r.pending, 0);
  for (const r of [notOkRes, overdueRes, cardsRes, rulesRes]) if (r.error) console.error("week digest read failed", r.error.message);

  return { child, stats, review, tutor, pendingRules, suggestions: weekSuggestions({ notOk, overdue, tutor }) };
}
