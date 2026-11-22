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
    const base = db.from("extra_classes").select(EXTRA_COLUMNS);
    const scoped = childIds.length === 1 ? base.eq("child_id", childIds[0]!) : base.in("child_id", [...childIds]);
    const { data, error } = await scoped.eq("active", true).order("created_at");
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

/**
 * The apps a class can give homework on, per child (22/11/2026, "Dán học thêm"): active,
 * non-placeholder app slots meant for that child or for the whole family. Read with the caller's
 * session (RLS: a parent sees the family). A read error gives none.
 */
export async function loadSlotChoices(db: SupabaseClient, childIds: readonly string[]): Promise<Map<string, { id: string; label: string }[]>> {
  const out = new Map<string, { id: string; label: string }[]>(childIds.map((id) => [id, []]));
  try {
    const { data, error } = await db.from("app_slots").select("id, label, kind, child_id").eq("active", true);
    if (error) return out;
    for (const r of (data ?? []) as { id: string; label: string; kind: string; child_id: string | null }[]) {
      if (r.kind === "placeholder") continue;
      for (const id of childIds) if (r.child_id === null || r.child_id === id) out.get(id)!.push({ id: r.id, label: r.label });
    }
  } catch {
    /* none */
  }
  return out;
}
