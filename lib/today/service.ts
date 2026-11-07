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
import { reviewWeek, type WeekStats } from "./week";
import { loadWeekStats, loadWeeklyReview, type WeeklyReview } from "./week-load";

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
  /** First local date this child has a day row (week strip shows earlier days as "—"). */
  firstDay: string;
  /** S2e: today's plan (task keys in the child's order), or null. Display only. */
  plan: string[] | null;
  /** S2e: the icon the child picked, or null. */
  icon: string | null;
  /** S2e: the weekly review while it is open (Sunday 17:00 -> end of Monday), else null. */
  weekly: { stats: WeekStats; review: WeeklyReview | null } | null;
  /** Family rules the screen needs for its wording (minutes, thresholds). */
  rules: TodayRules;
  /** Today's runs a parent has looked at ("Bố mẹ đã xem ✓"; the verdict itself is not shown). */
  reviewed: string[];
  /** Running homework the child asked a parent to look at ("Nhờ bố mẹ xem trực tiếp"). */
  asked: string[];
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
 * Persists lazily derived milestones. Each value only fills a column that is still NULL, so two
 * concurrent reads can never move a milestone (first writer wins).
 *
 * R1 (07/11/2026): the parts finish in any order, so any subset of the three milestones can
 * appear in one read. They are first written in ONE statement (all guarded columns still NULL).
 * If a concurrent read already wrote one of them, each column is filled on its own, parts
 * first and free time last, so free_started_at is never stored without both part milestones.
 */
async function persistMilestones(ctx: ChildContext, date: string, m: DayMilestones) {
  const admin = createAdminClient();
  await ensureSession(ctx, date);
  const cols: [keyof DayMilestones, string][] = [
    ["part1DoneAt", "part1_done_at"],
    ["part2DoneAt", "part2_done_at"],
    ["freeStartedAt", "free_started_at"],
  ];
  const present = cols.filter(([k]) => m[k]);
  if (present.length === 0) return;

  const row: Record<string, string> = {};
  for (const [k, col] of present) row[col] = m[k] as string;
  let q = admin.from("day_sessions").update(row).eq("child_id", ctx.childId).eq("local_date", date);
  for (const [, col] of present) q = q.is(col, null);
  const { data, error } = await q.select("child_id");
  if (error) throw new Error(`milestones: ${error.message}`);
  if ((data ?? []).length > 0 || present.length === 1) return;

  for (const [k, col] of present) {
    const { error: e } = await admin
      .from("day_sessions")
      .update({ [col]: m[k] as string })
      .eq("child_id", ctx.childId)
      .eq("local_date", date)
      .is(col, null);
    if (e) throw new Error(`milestone ${col}: ${e.message}`);
  }
}

/**
 * Reads the child's day with the SERVER clock, persists any lazily derived milestones,
 * and returns the state (recomputed after persisting so it always matches the database).
 */
export async function readToday(
  ctx: ChildContext,
  now = new Date(),
): Promise<{ state: DayState; homeworkPhotos: Record<string, string[]>; rules: TodayRules; bedtime: string }> {
  const today = localDate(now);
  let loaded = await loadDay(ctx.db, ctx.childId, ctx.familyId, today);
  let state = computeDayState(loaded.input, now);
  if (Object.keys(state.milestones).length > 0) {
    await persistMilestones(ctx, today, state.milestones);
    loaded = await loadDay(ctx.db, ctx.childId, ctx.familyId, today);
    state = computeDayState(loaded.input, now);
  }
  const { breakMinutes, freeMinutes, trustUpPct } = loaded.input.settings;
  return { state, homeworkPhotos: loaded.homeworkPhotos, rules: { breakMinutes, freeMinutes, trustUpPct }, bedtime: loaded.input.bedtime };
}

/** Day state + attachments of the homework that is on today's list. */
export async function todayView(ctx: ChildContext, now = new Date()): Promise<TodayView> {
  const { state, homeworkPhotos, rules, bedtime } = await readToday(ctx, now);
  const files: Record<string, AttachmentView[]> = {};
  for (const i of state.part1.items) if (i.source === "homework") files[i.id] = attachmentViews(homeworkPhotos[i.id] ?? []);
  const first = await ctx.db.from("day_sessions").select("local_date").eq("child_id", ctx.childId).order("local_date").limit(1).maybeSingle();
  const firstDay = (first.data?.local_date as string | undefined) ?? state.localDate;
  const [plan, icon, weekly, reviewed, asked] = await Promise.all([
    readPlan(ctx, state.localDate),
    readIcon(ctx),
    readWeekly(ctx, now, bedtime),
    readReviewed(ctx, state.localDate),
    readAsked(ctx, state.localDate),
  ]);
  return { state, homeworkFiles: files, rules, firstDay, plan, icon, weekly, reviewed, asked };
}

// S2e extras are display only: if one cannot be read (e.g. a preview before migration
// 0003), the screen simply goes without it. The lock state above never depends on them.

async function readPlan(ctx: ChildContext, date: string): Promise<string[] | null> {
  const { data, error } = await ctx.db.from("day_plans").select("item_keys").eq("child_id", ctx.childId).eq("local_date", date).maybeSingle();
  if (error || !data) return null;
  return (data.item_keys as string[] | null)?.length ? (data.item_keys as string[]) : null;
}

async function readReviewed(ctx: ChildContext, date: string): Promise<string[]> {
  const { data, error } = await ctx.db.from("task_runs").select("id").eq("child_id", ctx.childId).eq("local_date", date).not("parent_verdict", "is", null);
  if (error || !data) return [];
  return data.map((r) => r.id as string);
}

async function readAsked(ctx: ChildContext, date: string): Promise<string[]> {
  const { data, error } = await ctx.db
    .from("task_runs")
    .select("id")
    .eq("child_id", ctx.childId)
    .eq("local_date", date)
    .not("confirm_requested_at", "is", null)
    .is("done_at", null);
  if (error || !data) return []; // before migration 0006: no requests
  return data.map((r) => r.id as string);
}

async function readIcon(ctx: ChildContext): Promise<string | null> {
  const { data, error } = await ctx.db.from("profiles").select("icon").eq("id", ctx.childId).maybeSingle();
  if (error || !data) return null;
  return (data.icon as string | null) ?? null;
}

async function readWeekly(ctx: ChildContext, now: Date, bedtime: string): Promise<TodayView["weekly"]> {
  const week = reviewWeek(now);
  if (!week) return null;
  try {
    const [stats, review] = await Promise.all([loadWeekStats(ctx.db, ctx.childId, week, bedtime), loadWeeklyReview(ctx.db, ctx.childId, week)]);
    return { stats, review };
  } catch (e) {
    console.error("weekly review read failed", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Standard error handling for the child routes: never leak details, stay fail-closed. */
export function serverError(where: string, e: unknown) {
  console.error(`${where} failed`, e instanceof Error ? e.message : e);
  return jsonError("Máy chủ đang lỗi, thử lại sau ít phút.", 500);
}
