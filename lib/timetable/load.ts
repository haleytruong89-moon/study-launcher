import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fromRow, type TimetableVersion } from "./rules";

/**
 * The timetable versions of some children, read with the CALLER's session (RLS: a parent sees
 * the family, a child only their own). A read error gives [] (the screens simply show no
 * timetable), never a broken page.
 */
export async function loadTimetables(db: SupabaseClient, childIds: readonly string[]): Promise<TimetableVersion[]> {
  if (childIds.length === 0) return [];
  try {
    const { data, error } = await db
      .from("timetables")
      .select("id, child_id, valid_from, label, note, periods, times, uniform")
      .in("child_id", [...childIds])
      .order("valid_from", { ascending: false });
    if (error) {
      console.error("timetable read failed", error.message);
      return [];
    }
    return (data ?? []).map((r) => fromRow(r as Parameters<typeof fromRow>[0]));
  } catch (e) {
    console.error("timetable read failed", e instanceof Error ? e.message : e);
    return [];
  }
}
