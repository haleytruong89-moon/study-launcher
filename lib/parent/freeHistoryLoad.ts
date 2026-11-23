import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChildSummary } from "@/lib/admin/page";
import { computeDayState, type DayState } from "@/lib/dayState";
import { addDays, nextMidnight, startOfLocalDay } from "@/lib/time";
import { loadDay } from "@/lib/today/load";
import { freeDay, overrideLines, type FreeDay, type OverrideRow } from "./freeHistory";

export const FREE_HISTORY_DAYS = 7;
const OVERRIDE_ACTIONS = ["override.open", "override.lock", "override.extend", "override.clear"];

/**
 * Each child's last 7 days of free time (newest first), read with the parent's own session
 * (RLS: this family only). A day's numbers are that day's DayState computed one second before
 * its midnight (today: now), from the same loader the Launcher and the extension use. Only days
 * where free time started or the parent changed the lock are listed. Display only.
 */
export async function loadFreeHistory(
  db: SupabaseClient,
  familyId: string,
  children: ChildSummary[],
  today: string,
  now: Date,
): Promise<Map<string, FreeDay[]>> {
  const from = addDays(today, -(FREE_HISTORY_DAYS - 1));
  const [{ data: sessions }, { data: audits }] = await Promise.all([
    db
      .from("day_sessions")
      .select("child_id, local_date, free_started_at")
      .in(
        "child_id",
        children.map((c) => c.id),
      )
      .gte("local_date", from)
      .lte("local_date", today)
      .not("free_started_at", "is", null),
    db
      .from("audit_log")
      .select("action, payload, created_at")
      .in("action", OVERRIDE_ACTIONS)
      .gte("created_at", startOfLocalDay(from).toISOString())
      .order("created_at"),
  ]);
  const overrides = (audits ?? []) as OverrideRow[];
  const started = new Set(((sessions ?? []) as { child_id: string; local_date: string }[]).map((s) => `${s.child_id}|${s.local_date}`));

  const out = new Map<string, FreeDay[]>();
  await Promise.all(
    children.map(async (child) => {
      const days: FreeDay[] = [];
      for (let i = 0; i < FREE_HISTORY_DAYS; i++) {
        const date = addDays(today, -i);
        const lines = overrideLines(overrides, child.id, date);
        const hasFree = started.has(`${child.id}|${date}`);
        if (!hasFree && lines.length === 0) continue;
        let state: DayState | null = null;
        let freeMinutes = 0;
        if (hasFree) {
          try {
            const { input } = await loadDay(db, child.id, familyId, date);
            const at = date === today ? now : new Date(nextMidnight(startOfLocalDay(date)).getTime() - 1000);
            state = computeDayState(input, at);
            freeMinutes = input.settings.freeMinutes;
          } catch (e) {
            console.error("free history failed", e instanceof Error ? e.message : e);
          }
        }
        days.push(freeDay(date, state, freeMinutes, lines));
      }
      out.set(child.id, days);
    }),
  );
  return out;
}
