import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { computeDayState, type DayMilestones, type DayState } from "@/lib/dayState";
import { attachmentViews, type AttachmentView } from "@/lib/files";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { localDate } from "@/lib/time";
import { loadDay } from "./load";

export interface ChildContext {
  childId: string;
  familyId: string;
  displayName: string;
  grade: number | null;
  color: string | null;
  /** Acts as the child: SELECT only (RLS). Used for every read. */
  db: SupabaseClient;
}

/** What the Launcher receives: the day state + the parent's homework attachments. */
export interface TodayView {
  state: DayState;
  /** homework id -> attachments, opened via /api/files/homework (child session, RLS-checked). */
  homeworkFiles: Record<string, AttachmentView[]>;
  /** Family rules the screen needs for its wording (minutes, thresholds). */
  rules: TodayRules;
}

export interface TodayRules {
  breakMinutes: number;
  freeMinutes: number;
  trustUpPct: number;
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Route guard for the child's routes: signed in AND role child. */
export async function requireChild(): Promise<{ ok: true; ctx: ChildContext } | { ok: false; response: NextResponse }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, response: jsonError("Bạn chưa đăng nhập.", 401) };
  if (me.profile?.role !== "child") return { ok: false, response: jsonError("Chỉ tài khoản của con mới dùng được.", 403) };
  return {
    ok: true,
    ctx: {
      childId: me.userId,
      familyId: me.profile.family_id,
      displayName: me.profile.display_name,
      grade: me.profile.grade,
      color: me.profile.color,
      db: await createClient(),
    },
  };
}

/** Creates today's day_sessions row if missing (writes go through service_role only). */
export async function ensureSession(ctx: ChildContext, date: string) {
  const { error } = await createAdminClient()
    .from("day_sessions")
    .upsert({ child_id: ctx.childId, family_id: ctx.familyId, local_date: date }, { onConflict: "child_id,local_date", ignoreDuplicates: true });
  if (error) throw new Error(`ensureSession: ${error.message}`);
}

/**
 * Persists lazily derived milestones. Each update only fills a column that is still NULL,
 * so two concurrent reads can never move a milestone (first writer wins).
 */
async function persistMilestones(ctx: ChildContext, date: string, m: DayMilestones) {
  const admin = createAdminClient();
  await ensureSession(ctx, date);

  if (m.part1DoneAt) {
    const { error } = await admin
      .from("day_sessions")
      .update({ part1_done_at: m.part1DoneAt })
      .eq("child_id", ctx.childId)
      .eq("local_date", date)
      .is("part1_done_at", null);
    if (error) throw new Error(`milestone part1: ${error.message}`);
  }
  if (m.part2DoneAt) {
    // part2_done_at and free_started_at in ONE statement (DESIGN section 5).
    const row: Record<string, string> = { part2_done_at: m.part2DoneAt };
    if (m.freeStartedAt) row.free_started_at = m.freeStartedAt;
    let q = admin.from("day_sessions").update(row).eq("child_id", ctx.childId).eq("local_date", date).is("part2_done_at", null);
    if (m.freeStartedAt) q = q.is("free_started_at", null);
    const { error } = await q;
    if (error) throw new Error(`milestone part2: ${error.message}`);
  } else if (m.freeStartedAt) {
    const { error } = await admin
      .from("day_sessions")
      .update({ free_started_at: m.freeStartedAt })
      .eq("child_id", ctx.childId)
      .eq("local_date", date)
      .is("free_started_at", null);
    if (error) throw new Error(`milestone free: ${error.message}`);
  }
}

/**
 * Reads the child's day with the SERVER clock, persists any lazily derived milestones,
 * and returns the state (recomputed after persisting so it always matches the database).
 */
export async function readToday(
  ctx: ChildContext,
  now = new Date(),
): Promise<{ state: DayState; homeworkPhotos: Record<string, string[]>; rules: TodayRules }> {
  const today = localDate(now);
  let loaded = await loadDay(ctx.db, ctx.childId, ctx.familyId, today);
  let state = computeDayState(loaded.input, now);
  if (Object.keys(state.milestones).length > 0) {
    await persistMilestones(ctx, today, state.milestones);
    loaded = await loadDay(ctx.db, ctx.childId, ctx.familyId, today);
    state = computeDayState(loaded.input, now);
  }
  const { breakMinutes, freeMinutes, trustUpPct } = loaded.input.settings;
  return { state, homeworkPhotos: loaded.homeworkPhotos, rules: { breakMinutes, freeMinutes, trustUpPct } };
}

/** Day state + attachments of the homework that is on today's list. */
export async function todayView(ctx: ChildContext, now = new Date()): Promise<TodayView> {
  const { state, homeworkPhotos, rules } = await readToday(ctx, now);
  const files: Record<string, AttachmentView[]> = {};
  for (const i of state.part1.items) if (i.source === "homework") files[i.id] = attachmentViews(homeworkPhotos[i.id] ?? []);
  return { state, homeworkFiles: files, rules };
}

/** Standard error handling for the child routes: never leak details, stay fail-closed. */
export function serverError(where: string, e: unknown) {
  console.error(`${where} failed`, e instanceof Error ? e.message : e);
  return jsonError("Máy chủ đang lỗi, thử lại sau ít phút.", 500);
}
