import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTimetables } from "@/lib/timetable/load";
import type { TimetableVersion } from "@/lib/timetable/rules";
import { fromExtraRow, type ExtraClass, type SubjectPref } from "./rules";

export interface ScheduleData {
  versions: TimetableVersion[];
  extras: ExtraClass[];
  /** Subject prefs with their child (a parent may load several children). */
  prefs: (SubjectPref & { childId: string })[];
}

export const EXTRA_COLUMNS = "id, child_id, subject, sessions, place, bring, note, app_slot_id, active";

/** Active extra classes of some children, with the CALLER's session (RLS). Errors give []. */
export async function loadExtras(db: SupabaseClient, childIds: readonly string[]): Promise<ExtraClass[]> {
  if (childIds.length === 0) return [];
  try {
    const { data, error } = await db.from("extra_classes").select(EXTRA_COLUMNS).in("child_id", [...childIds]).eq("active", true).order("created_at");
    if (error) {
      console.error("extra_classes read failed", error.message);
      return [];
    }
    return (data ?? []).map((r) => fromExtraRow(r as Parameters<typeof fromExtraRow>[0]));
  } catch (e) {
    console.error("extra_classes read failed", e instanceof Error ? e.message : e);
    return [];
  }
}

/** Timetable versions + extra classes + subject prefs (21/11/2026). A read error gives empty lists. */
export async function loadSchedule(db: SupabaseClient, childIds: readonly string[]): Promise<ScheduleData> {
  if (childIds.length === 0) return { versions: [], extras: [], prefs: [] };
  const [versions, extras, pr] = await Promise.all([
    loadTimetables(db, childIds),
    loadExtras(db, childIds),
    Promise.resolve(db.from("subject_prefs").select("child_id, subject_key, label, color, bring").in("child_id", [...childIds])).catch(() => ({ data: null, error: { message: "network" } })),
  ]);
  if (pr.error) console.error("subject_prefs read failed", pr.error.message);
  return {
    versions,
    extras,
    prefs: (pr.data ?? []).map((r) => ({
      childId: r.child_id as string,
      key: r.subject_key as string,
      label: (r.label as string | null) ?? "",
      color: (r.color as string | null) ?? "",
      bring: (r.bring as string | null) ?? "",
    })),
  };
}
