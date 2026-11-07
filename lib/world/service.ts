import "server-only";
import { voiceFor } from "@/lib/binhYen/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDate } from "@/lib/time";
import type { ChildContext } from "@/lib/today/service";
import { findWorld } from "./catalog";
import { defaultWorld, monthOf, monthView, plantsToAdd, prevMonth, worldStarted, type WorldResponse, type WorldRow } from "./rules";
import type { Pillar } from "./types";

/** The world of the month is An's (scientist voice). Nguyên gets her comic in R5. */
export function hasWorld(ctx: ChildContext): boolean {
  return voiceFor(ctx.grade) === "scientist";
}

const firstDay = (month: string) => `${month}-01`;
const lastDay = (month: string) => {
  const [y, m] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
};

async function usedWorlds(childId: string): Promise<{ month: string; worldKey: string }[]> {
  const admin = createAdminClient();
  const [items, picks] = await Promise.all([
    admin.from("world_items").select("local_date, world_key").eq("child_id", childId),
    admin.from("world_months").select("month, world_key").eq("child_id", childId),
  ]);
  if (items.error) throw new Error(`world.used: ${items.error.message}`);
  if (picks.error) throw new Error(`world.picks: ${picks.error.message}`);
  const out = new Map<string, string>();
  for (const p of picks.data ?? []) out.set(monthOf(p.month as string), p.world_key as string);
  // A month with plants keeps the world it was planted in.
  for (const r of items.data ?? []) out.set(monthOf(r.local_date as string), r.world_key as string);
  return [...out].map(([month, worldKey]) => ({ month, worldKey }));
}

/** The world a month is (or will be) in: its plants' world, else the child's pick, else the default. */
function worldOf(month: string, used: { month: string; worldKey: string }[]): string {
  return used.find((u) => u.month === month)?.worldKey ?? defaultWorld(month, used);
}

/** Finished areas from the durable records (milestones, finished Góc bình yên visits) between two dates. */
async function finishedAreas(ctx: ChildContext, from: string, to: string): Promise<{ date: string; pillar: Pillar }[]> {
  const admin = createAdminClient();
  const [days, visits] = await Promise.all([
    admin.from("day_sessions").select("local_date, part1_done_at, part2_done_at, free_started_at").eq("child_id", ctx.childId).gte("local_date", from).lte("local_date", to),
    admin.from("by_checkins").select("local_date").eq("child_id", ctx.childId).gte("local_date", from).lte("local_date", to),
  ]);
  if (days.error) throw new Error(`world.days: ${days.error.message}`);
  const out: { date: string; pillar: Pillar }[] = [];
  for (const d of days.data ?? []) {
    const date = d.local_date as string;
    // Học tập / Kỹ năng only with a real milestone (a pass day grows only Vui chơi).
    if (d.part1_done_at) out.push({ date, pillar: "study" });
    if (d.part2_done_at) out.push({ date, pillar: "skill" });
    if (d.free_started_at) out.push({ date, pillar: "play" });
  }
  // Before Góc bình yên existed (no table) there are simply no "feel" plants.
  for (const v of visits.error ? [] : (visits.data ?? [])) out.push({ date: v.local_date as string, pillar: "feel" });
  return out;
}

/**
 * Plants what grew since the last time (this month and the month before, so the evening of the
 * last day of a month is not lost). Idempotent: one row per (child, day, area) by the unique key;
 * two syncs at once simply skip the same rows.
 */
export async function syncWorld(ctx: ChildContext, now = new Date()): Promise<void> {
  if (!hasWorld(ctx)) return;
  const today = localDate(now);
  const month = monthOf(today);
  const months = [prevMonth(month), month].filter(worldStarted);
  if (months.length === 0) return;
  const admin = createAdminClient();
  const used = await usedWorlds(ctx.childId);
  for (const m of months) {
    const to = m === month ? today : lastDay(m);
    const { data: existing, error } = await admin
      .from("world_items")
      .select("local_date, pillar, world_key, item_key, variant")
      .eq("child_id", ctx.childId)
      .gte("local_date", firstDay(m))
      .lte("local_date", lastDay(m));
    if (error) throw new Error(`world.items: ${error.message}`);
    const worldKey = worldOf(m, used);
    const add = plantsToAdd(await finishedAreas(ctx, firstDay(m), to), (existing ?? []) as WorldRow[], worldKey);
    if (add.length === 0) continue;
    const { error: insErr } = await admin
      .from("world_items")
      .upsert(add.map((r) => ({ ...r, family_id: ctx.familyId, child_id: ctx.childId })), { onConflict: "child_id,local_date,pillar", ignoreDuplicates: true });
    if (insErr) throw new Error(`world.plant: ${insErr.message}`);
    if (!used.some((u) => u.month === m)) used.push({ month: m, worldKey });
  }
}

/** Best effort (e.g. right after a Góc bình yên visit): a failure only waits for the next sync. */
export async function syncWorldQuietly(ctx: ChildContext): Promise<void> {
  try {
    await syncWorld(ctx);
  } catch (e) {
    console.error("world.sync", e instanceof Error ? e.message : e);
  }
}

/** A month of the child's world (default: this month) + the album of months with plants. */
export async function readWorld(ctx: ChildContext, month: string | null, now = new Date()): Promise<WorldResponse | null> {
  const today = localDate(now);
  const current = monthOf(today);
  const want = month ?? current;
  if (want > current || !worldStarted(want)) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.from("world_items").select("local_date, pillar, world_key, item_key, variant").eq("child_id", ctx.childId).order("local_date");
  if (error) throw new Error(`world.read: ${error.message}`);
  const rows = (data ?? []) as WorldRow[];
  const byMonth = new Map<string, WorldRow[]>();
  for (const r of rows) byMonth.set(monthOf(r.local_date), [...(byMonth.get(monthOf(r.local_date)) ?? []), r]);
  if (want !== current && !byMonth.has(want)) return null;
  const used = [...byMonth].map(([m, rs]) => ({ month: m, worldKey: rs[0]?.world_key ?? "rung" }));
  const { data: picks } = await admin.from("world_months").select("month, world_key").eq("child_id", ctx.childId);
  for (const p of picks ?? []) if (!used.some((u) => u.month === monthOf(p.month as string))) used.push({ month: monthOf(p.month as string), worldKey: p.world_key as string });
  const album = [...byMonth]
    .filter(([m]) => m !== current)
    .map(([m, rs]) => {
      const w = findWorld(rs[0]?.world_key ?? "");
      return { month: m, key: w?.key ?? "", name: w?.name ?? "Thế giới cũ", emoji: w?.emoji ?? "🌍", plants: rs.length };
    })
    .sort((a, b) => (a.month < b.month ? 1 : -1));
  return { view: monthView(want, worldOf(want, used), byMonth.get(want) ?? [], today), current: want === current, album };
}

/** Before migration 0013 runs (the preview, until the parents merge) the tables do not exist. */
export async function worldReady(): Promise<boolean> {
  const { error } = await createAdminClient().from("world_items").select("id").limit(1);
  if (!error) return true;
  if (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message)) return false;
  throw new Error(`world.ready: ${error.message}`);
}
