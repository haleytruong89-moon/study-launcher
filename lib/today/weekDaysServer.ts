import "server-only";
import { bySettings } from "@/lib/binhYen/session";
import { resolveWeek, shelfOf, volumeOf } from "@/lib/comic/volume";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, localDate, weekStart } from "@/lib/time";
import type { ChildContext } from "./service";
import { buildWeekDays, type WeekCheckinRow, type WeekDaysView, type WeekSessionRow } from "./weekDays";

/** Enough rows for the 12 newest shelf weeks (day_sessions: one per day; visits: a few per day). */
const SHELF_ROWS = 1000;

/**
 * Reads one week for THE CHILD OF THE REQUEST only (service_role, always filtered by child_id).
 * by_checkins has no browser grant (BINH_YEN §3); only keys are read, never free text. Errors
 * carry a short code only (no Postgres message that could quote a row, BINH_YEN D5).
 *
 * R5: `wanted` (a Monday) reads a past week for Nguyên's shelf; the allowed range is from the
 * week of the child's first record to this week (else null → 404). Every answer carries the
 * volume number of that week and the shelf (past weeks with a record).
 */
export async function weekDays(ctx: ChildContext, now = new Date(), wanted?: string | null): Promise<WeekDaysView | null> {
  const today = localDate(now);
  const thisMonday = weekStart(today);
  const admin = createAdminClient();
  const by = await bySettings(ctx.familyId);

  // The first record: the oldest day_sessions row or the oldest visit. Góc bình yên on or off,
  // the volume number (Tập N) counts from the child's first record, so numbers do not shift if
  // by is toggled. Only the oldest date is read here — no feeling data (R5 review L1).
  const [firstSession, firstCheckin] = await Promise.all([
    admin.from("day_sessions").select("local_date").eq("child_id", ctx.childId).order("local_date", { ascending: true }).limit(1),
    admin.from("by_checkins").select("local_date").eq("child_id", ctx.childId).order("local_date", { ascending: true }).limit(1),
  ]);
  if (firstSession.error || firstCheckin.error) throw new Error("week.days first");
  const firsts = [...(firstSession.data ?? []), ...(firstCheckin.data ?? [])].map((r) => (r as { local_date: string }).local_date).sort();
  const firstMonday = firsts[0] ? weekStart(firsts[0]) : null;

  const monday = resolveWeek(wanted, thisMonday, firstMonday);
  if (!monday) return null;
  const sunday = addDays(monday, 6);
  const lastShelfDay = addDays(thisMonday, -1);

  const [sessions, checkins, shelfSessions, shelfCheckins] = await Promise.all([
    admin
      .from("day_sessions")
      .select("local_date, part1_done_at, part2_done_at, free_started_at")
      .eq("child_id", ctx.childId)
      .gte("local_date", monday)
      .lte("local_date", sunday),
    by.enabled
      ? admin
          .from("by_checkins")
          .select("local_date, quad, word_key, created_at, activity_key")
          .eq("child_id", ctx.childId)
          .gte("local_date", monday)
          .lte("local_date", sunday)
      : Promise.resolve(null),
    firstMonday
      ? admin
          .from("day_sessions")
          .select("local_date")
          .eq("child_id", ctx.childId)
          .gte("local_date", firstMonday)
          .lte("local_date", lastShelfDay)
          .order("local_date", { ascending: false })
          .limit(SHELF_ROWS)
      : Promise.resolve({ data: [] as { local_date: string }[], error: null }),
    firstMonday && by.enabled
      ? admin
          .from("by_checkins")
          .select("local_date")
          .eq("child_id", ctx.childId)
          .gte("local_date", firstMonday)
          .lte("local_date", lastShelfDay)
          .order("local_date", { ascending: false })
          .limit(SHELF_ROWS)
      : Promise.resolve({ data: [] as { local_date: string }[], error: null }),
  ]);
  if (sessions.error) throw new Error("week.days sessions");
  if (checkins?.error) throw new Error("week.days checkins");
  if (shelfSessions.error || shelfCheckins.error) throw new Error("week.days shelf");

  const base = buildWeekDays(monday, today, (sessions.data ?? []) as WeekSessionRow[], checkins ? ((checkins.data ?? []) as WeekCheckinRow[]) : null);
  const shelfDates = [...(shelfSessions.data ?? []), ...(shelfCheckins.data ?? [])].map((r) => (r as { local_date: string }).local_date);
  return { ...base, volume: volumeOf(firstMonday, monday), shelf: shelfOf(shelfDates, firstMonday, thisMonday) };
}
