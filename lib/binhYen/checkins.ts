import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ChildContext } from "@/lib/today/service";
import { localDate } from "@/lib/time";
import { HEAVY_REPEAT_DAYS, RECENT_LIMIT, checkinView, heavyRepeat, type CheckinBody, type CheckinRow, type CheckinView } from "./checkin";
import type { Voice } from "./catalog";

/**
 * by_checkins I/O (migration 0009). Server only, service_role, ALWAYS filtered by the child of
 * the request: no browser has any grant on the table (BINH_YEN §3). Errors carry a short code
 * only — never a Postgres message, which could quote a row (D5). No audit_log (D5).
 */

const COLUMNS = "id, local_date, quad, word_key, intensity, activity_key, created_at";

export interface SaveResult {
  saved: true;
  /** The same client_run_id was already stored (a second tap on "Xong"). */
  repeated: boolean;
  /** 3 × "rất to" in 7 days: a 111 note for the child only (never sent anywhere). */
  heavy: boolean;
}

/** Stores one finished visit once per client_run_id. Returns null when that id belongs to someone else. */
export async function saveCheckin(ctx: ChildContext, b: CheckinBody, now = new Date()): Promise<SaveResult | null> {
  const admin = createAdminClient();
  const row = {
    family_id: ctx.familyId,
    child_id: ctx.childId,
    local_date: localDate(now),
    quad: b.quad,
    word_key: b.word,
    intensity: b.intensity,
    activity_key: b.activity,
    client_run_id: b.clientRunId,
    created_at: now.toISOString(),
  };
  const { data, error } = await admin.from("by_checkins").upsert(row, { onConflict: "client_run_id", ignoreDuplicates: true }).select("id");
  if (error) throw new Error("by_checkins insert");
  let repeated = false;
  if (!data?.length) {
    const { data: mine, error: readErr } = await admin.from("by_checkins").select("id").eq("client_run_id", b.clientRunId).eq("child_id", ctx.childId).maybeSingle();
    if (readErr) throw new Error("by_checkins reread");
    if (!mine) return null;
    repeated = true;
  }
  const since = new Date(now.getTime() - HEAVY_REPEAT_DAYS * 86_400_000).toISOString();
  const { data: recent, error: heavyErr } = await admin.from("by_checkins").select("intensity, created_at").eq("child_id", ctx.childId).eq("intensity", 5).gte("created_at", since);
  if (heavyErr) throw new Error("by_checkins heavy");
  return { saved: true, repeated, heavy: heavyRepeat((recent ?? []) as Pick<CheckinRow, "intensity" | "created_at">[], now) };
}

/** "Lần ghé gần đây": the child's last 7 visits. */
export async function recentCheckins(ctx: ChildContext, voice: Voice): Promise<CheckinView[]> {
  const { data, error } = await createAdminClient()
    .from("by_checkins")
    .select(COLUMNS)
    .eq("child_id", ctx.childId)
    .order("created_at", { ascending: false })
    .limit(RECENT_LIMIT);
  if (error) throw new Error("by_checkins list");
  return ((data ?? []) as CheckinRow[]).map((r) => checkinView(r, voice));
}

/** Hard delete (Q7): one visit of this child, or all of them. Returns how many rows went. */
export async function deleteCheckins(ctx: ChildContext, which: { id: string } | { all: true }): Promise<number> {
  let q = createAdminClient().from("by_checkins").delete().eq("child_id", ctx.childId);
  if ("id" in which) q = q.eq("id", which.id);
  const { data, error } = await q.select("id");
  if (error) throw new Error("by_checkins delete");
  return data?.length ?? 0;
}
