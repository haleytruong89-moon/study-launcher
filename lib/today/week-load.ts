import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DaySessionInput } from "@/lib/dayState";
import { addDays, startOfLocalDay } from "@/lib/time";
import { weekStats, type WeekStats } from "./week";

export interface WeeklyReview {
  wentWell: string | null;
  changeNext: string | null;
  updatedAt: string;
}

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`loadWeek: ${what}: ${res.error.message}`);
  return (res.data ?? ([] as unknown)) as T;
}

/**
 * Loads one child's week (Monday `weekStart`) and computes the review numbers. `db` is
 * the viewer's own session (child: own rows; parent: the family), so RLS bounds it.
 */
export async function loadWeekStats(db: SupabaseClient, childId: string, weekStart: string, bedtime: string): Promise<WeekStats> {
  const weekEnd = addDays(weekStart, 6);
  const from = startOfLocalDay(weekStart).toISOString();
  const to = startOfLocalDay(addDays(weekStart, 7)).toISOString();

  const [sessions, runs, plans, doneHomework] = await Promise.all([
    db
      .from("day_sessions")
      .select("local_date, day_type, disabled_template_ids, break_started_at, break_ended_at, break_skipped, part1_done_at, part2_done_at, free_started_at, pass_used_at")
      .eq("child_id", childId)
      .gte("local_date", weekStart)
      .lte("local_date", weekEnd),
    db.from("task_runs").select("local_date, source, homework_item_id, template_id, started_at, done_at").eq("child_id", childId).gte("local_date", weekStart).lte("local_date", weekEnd),
    db.from("day_plans").select("local_date, item_keys").eq("child_id", childId).gte("local_date", weekStart).lte("local_date", weekEnd),
    db.from("homework_items").select("id, due_date, done_at").eq("child_id", childId).is("archived_at", null).gte("done_at", from).lt("done_at", to),
  ]);

  type Hw = { id: string; due_date: string; done_at: string | null };
  const planRows = check(plans, "day_plans") as { local_date: string; item_keys: string[] }[];
  const homework = check(doneHomework, "homework_items") as Hw[];
  const known = new Set(homework.map((h) => h.id));
  const planned = [...new Set(planRows.flatMap((p) => p.item_keys).filter((k) => k.startsWith("homework:")).map((k) => k.slice(9)))].filter((id) => !known.has(id));
  if (planned.length > 0) {
    const extra = check(await db.from("homework_items").select("id, due_date, done_at").in("id", planned), "planned homework") as Hw[];
    homework.push(...extra);
  }

  return weekStats({
    weekStart,
    bedtime,
    sessions: (check(sessions, "day_sessions") as Record<string, unknown>[]).map(
      (s): DaySessionInput => ({
        localDate: s.local_date as string,
        dayType: s.day_type as DaySessionInput["dayType"],
        disabledTemplateIds: (s.disabled_template_ids as string[] | null) ?? [],
        breakStartedAt: s.break_started_at as string | null,
        breakEndedAt: s.break_ended_at as string | null,
        breakSkipped: s.break_skipped as boolean,
        part1DoneAt: s.part1_done_at as string | null,
        part2DoneAt: s.part2_done_at as string | null,
        freeStartedAt: s.free_started_at as string | null,
        passUsedAt: s.pass_used_at as string | null,
      }),
    ),
    runs: (check(runs, "task_runs") as Record<string, unknown>[]).map((r) => ({
      localDate: r.local_date as string,
      source: r.source as "homework" | "template",
      homeworkItemId: r.homework_item_id as string | null,
      templateId: r.template_id as string | null,
      startedAt: r.started_at as string | null,
      doneAt: r.done_at as string | null,
    })),
    homework: homework.map((h) => ({ id: h.id, dueDate: h.due_date, doneAt: h.done_at })),
    plans: planRows.map((p) => ({ localDate: p.local_date, itemKeys: p.item_keys ?? [] })),
  });
}

/** The child's answers for that week, or null. Missing table (before 0003) reads as null. */
export async function loadWeeklyReview(db: SupabaseClient, childId: string, weekStart: string): Promise<WeeklyReview | null> {
  const { data, error } = await db.from("weekly_reviews").select("went_well, change_next, updated_at").eq("child_id", childId).eq("week_start", weekStart).maybeSingle();
  if (error || !data) return null;
  return { wentWell: data.went_well, changeNext: data.change_next, updatedAt: data.updated_at };
}
