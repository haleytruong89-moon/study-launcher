import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaskView } from "@/lib/dayState/types";
import { versionOn, type DayPlan } from "@/lib/timetable/rules";
import { classPrep } from "./classPrep";
import type { ScheduleData } from "./load";
import { prepItems, type PrepView } from "./prep";
import { extrasOn, subjectRows } from "./rules";

/** The child's ticks for `date` (before migration 0026, or on a read error: none). */
export async function readPrepCheck(db: SupabaseClient, childId: string, date: string): Promise<{ ticked: string[]; doneAt: string | null }> {
  try {
    const { data, error } = await db.from("prep_checks").select("ticked, done_at").eq("child_id", childId).eq("for_date", date).maybeSingle();
    if (error || !data) return { ticked: [], doneAt: null };
    return { ticked: (data.ticked as string[] | null) ?? [], doneAt: (data.done_at as string | null) ?? null };
  } catch {
    return { ticked: [], doneAt: null };
  }
}

/**
 * The "Ngày mai" checklist of one child for the next school day `next`. `tasks` are today's tasks
 * (Phần 1 + Phần 2), for the "làm trước buổi học thêm" rows; pass [] where they are not needed
 * (the tick route only keeps the rows the child ticks).
 */
export function buildPrep(
  schedule: Pick<ScheduleData, "versions" | "extras" | "prefs">,
  next: DayPlan,
  tasks: readonly TaskView[],
  check: { ticked: string[]; doneAt: string | null },
  nowMs: number,
  today: string,
): PrepView {
  const { versions, extras, prefs } = schedule;
  const rows = subjectRows(versionOn(versions, next.date), extras, prefs);
  const items = prepItems({
    plan: next,
    extrasNext: extrasOn(extras, next.date),
    rows,
    prep: classPrep(tasks, extras, nowMs, today, { includeDone: true }),
    items: tasks,
    ticked: check.ticked,
  });
  return { date: next.date, items, ticked: check.ticked, doneAt: check.doneAt };
}

