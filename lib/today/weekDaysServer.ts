import "server-only";
import { bySettings } from "@/lib/binhYen/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, localDate, weekStart } from "@/lib/time";
import type { ChildContext } from "./service";
import { buildWeekDays, type WeekCheckinRow, type WeekDaysView, type WeekSessionRow } from "./weekDays";

/**
 * Reads this week for THE CHILD OF THE REQUEST only (service_role, always filtered by child_id).
 * by_checkins has no browser grant (BINH_YEN §3); only keys are read, never free text. Errors
 * carry a short code only (no Postgres message that could quote a row, BINH_YEN D5).
 */
export async function weekDays(ctx: ChildContext, now = new Date()): Promise<WeekDaysView> {
  const today = localDate(now);
  const monday = weekStart(today);
  const sunday = addDays(monday, 6);
  const admin = createAdminClient();
  const [sessions, by] = await Promise.all([
    admin
      .from("day_sessions")
      .select("local_date, part1_done_at, part2_done_at, free_started_at")
      .eq("child_id", ctx.childId)
      .gte("local_date", monday)
      .lte("local_date", sunday),
    bySettings(ctx.familyId),
  ]);
  if (sessions.error) throw new Error("week.days sessions");
  let checkins: WeekCheckinRow[] | null = null;
  if (by.enabled) {
    const { data, error } = await admin
      .from("by_checkins")
      .select("local_date, quad, word_key, created_at, activity_key")
      .eq("child_id", ctx.childId)
      .gte("local_date", monday)
      .lte("local_date", sunday);
    if (error) throw new Error("week.days checkins");
    checkins = (data ?? []) as WeekCheckinRow[];
  }
  return buildWeekDays(monday, today, (sessions.data ?? []) as WeekSessionRow[], checkins);
}
