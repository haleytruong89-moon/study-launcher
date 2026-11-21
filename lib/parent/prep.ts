import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSchedule } from "@/lib/schedule/load";
import { prepParentLine, tickableKeys } from "@/lib/schedule/prep";
import { buildPrep } from "@/lib/schedule/prepServer";
import { atLocalTime } from "@/lib/time";
import { DAY_NAMES, PREPARE_FROM, nextSchoolDay } from "@/lib/timetable/rules";

/**
 * Each child's "Chuẩn bị cho ngày mai" line on the parent home (21/11/2026), read with the parent's
 * own session (RLS: this family). Display only; a read error gives no line.
 */
export async function loadPrepLines(db: SupabaseClient, childIds: readonly string[], today: string, now: Date): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (childIds.length === 0) return out;
  try {
    const schedule = await loadSchedule(db, childIds);
    const nexts = childIds.map((id) => ({ id, next: nextSchoolDay(schedule.versions.filter((v) => v.childId === id), today) }));
    const dates = [...new Set(nexts.flatMap((n) => (n.next ? [n.next.date] : [])))];
    if (dates.length === 0) return out;
    const { data, error } = await db.from("prep_checks").select("child_id, for_date, ticked, done_at").in("child_id", [...childIds]).in("for_date", dates);
    const rows = error ? [] : ((data ?? []) as { child_id: string; for_date: string; ticked: string[] | null; done_at: string | null }[]);
    const evening = now.getTime() >= atLocalTime(today, PREPARE_FROM).getTime();
    for (const { id, next } of nexts) {
      if (!next) continue;
      const row = rows.find((r) => r.child_id === id && r.for_date === next.date);
      const mine = {
        versions: schedule.versions.filter((v) => v.childId === id),
        extras: schedule.extras.filter((e) => e.childId === id),
        prefs: schedule.prefs.filter((p) => p.childId === id),
      };
      const check = { ticked: row?.ticked ?? [], doneAt: row?.done_at ?? null };
      const keys = tickableKeys(buildPrep(mine, next, [], check, now.getTime(), today).items);
      const line = prepParentLine({
        dayName: DAY_NAMES[next.weekday] ?? "ngày mai",
        keys: keys.length,
        ticked: check.ticked.filter((k) => keys.includes(k)).length,
        doneAt: check.doneAt,
        evening,
      });
      if (line) out.set(id, line);
    }
  } catch (e) {
    console.error("parent prep lines", e instanceof Error ? e.message : e);
  }
  return out;
}
