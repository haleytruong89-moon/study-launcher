import "server-only";
import { voiceFor } from "@/lib/binhYen/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDate } from "@/lib/time";
import type { ChildContext } from "@/lib/today/service";
import { findWorld } from "./catalog";
import { feelGrowthOf, monthOf, monthView, plantsToAdd, prevMonth, worldOfMonth, worldStarted, type FeelGrowth, type WorldChoice, type WorldResponse, type WorldRow } from "./rules";
import { PILLARS, type Pillar } from "./types";

/** The world of the month is An's (scientist voice). Nguyên gets her comic in R5. */
export function hasWorld(ctx: ChildContext): boolean {
  return voiceFor(ctx.grade) === "scientist";
}

const firstDay = (month: string) => `${month}-01`;
const lastDay = (month: string) => {
  const [y, m] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
};

interface Known {
  planted: Map<string, string>;
  picked: Map<string, string>;
}

/** Which world each month is in: from its plants (fixed) and from An's picks (world_months). */
async function knownWorlds(childId: string): Promise<Known> {
  const admin = createAdminClient();
  const [items, picks] = await Promise.all([
    admin.from("world_items").select("local_date, world_key").eq("child_id", childId),
    admin.from("world_months").select("month, world_key").eq("child_id", childId),
  ]);
  if (items.error) throw new Error(`world.used: ${items.error.message}`);
  if (picks.error) throw new Error(`world.picks: ${picks.error.message}`);
  const planted = new Map<string, string>();
  for (const r of items.data ?? []) if (!planted.has(monthOf(r.local_date as string))) planted.set(monthOf(r.local_date as string), r.world_key as string);
  const picked = new Map<string, string>();
  for (const p of picks.data ?? []) picked.set(monthOf(p.month as string), p.world_key as string);
  return { planted, picked };
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
  if (visits.error) throw new Error(`world.visits: ${visits.error.message}`);
  for (const v of visits.data ?? []) out.push({ date: v.local_date as string, pillar: "feel" });
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
  const known = await knownWorlds(ctx.childId);
  for (const m of months) {
    const to = m === month ? today : lastDay(m);
    const { data: existing, error } = await admin
      .from("world_items")
      .select("local_date, pillar, world_key, item_key, variant")
      .eq("child_id", ctx.childId)
      .gte("local_date", firstDay(m))
      .lte("local_date", lastDay(m));
    if (error) throw new Error(`world.items: ${error.message}`);
    // No world yet (An has not picked this month's, or no new pack): plant later from the stored milestones.
    const worldKey = worldOfMonth(m, m === month, known).key;
    if (!worldKey) continue;
    const add = plantsToAdd(await finishedAreas(ctx, firstDay(m), to), (existing ?? []) as WorldRow[], worldKey);
    if (add.length === 0) continue;
    const { error: insErr } = await admin
      .from("world_items")
      .upsert(add.map((r) => ({ ...r, family_id: ctx.familyId, child_id: ctx.childId })), { onConflict: "child_id,local_date,pillar", ignoreDuplicates: true });
    if (insErr) throw new Error(`world.plant: ${insErr.message}`);
    if (!known.planted.has(m)) known.planted.set(m, worldKey);
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

function choiceOf(key: string): WorldChoice | null {
  const w = findWorld(key);
  if (!w) return null;
  const peek = PILLARS.map((p) => w.things[p][0]).filter((t) => t !== undefined).slice(0, 3);
  return { key: w.key, name: w.name, emoji: w.emoji, intro: w.intro, peek: peek.map((t) => ({ name: t.name, icon: t.icon })) };
}

/** A month of the child's world (default: this month) + the album of months with plants (+ the choice, R4b). */
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
  const known = await knownWorlds(ctx.childId);
  const album = [...byMonth]
    .filter(([m]) => m !== current)
    .map(([m, rs]) => {
      const w = findWorld(rs[0]?.world_key ?? "");
      return { month: m, key: w?.key ?? "", name: w?.name ?? "Thế giới cũ", emoji: w?.emoji ?? "🌍", plants: rs.length };
    })
    .sort((a, b) => (a.month < b.month ? 1 : -1));
  const { key, choose } = worldOfMonth(want, want === current, known);
  return {
    month: want,
    view: key ? monthView(want, key, byMonth.get(want) ?? [], today) : null,
    choose: choose.map(choiceOf).filter((c): c is WorldChoice => c !== null),
    current: want === current,
    album,
  };
}

/**
 * R4b: An picks this month's world. Only a world on offer (a pack not used in the last 11
 * months), only while the month has no pick and no plants. Then what grew since the 1st is
 * planted at once. "already" also when the page was opened in another month (midnight).
 */
export async function chooseWorld(ctx: ChildContext, key: string, forMonth: string | undefined, now = new Date()): Promise<"ok" | "not_offered" | "already"> {
  const month = monthOf(localDate(now));
  if (forMonth !== undefined && forMonth !== month) return "already";
  // The month before gets its world first, so this month's choice never repeats it.
  await syncWorld(ctx, now);
  const known = await knownWorlds(ctx.childId);
  const { key: fixed, choose } = worldOfMonth(month, true, known);
  if (fixed) return "already";
  if (!choose.includes(key)) return "not_offered";
  const { error } = await createAdminClient().from("world_months").insert({ family_id: ctx.familyId, child_id: ctx.childId, month: `${month}-01`, world_key: key });
  if (error?.code === "23505") return "already";
  if (error) throw new Error(`world.choose: ${error.message}`);
  await syncWorld(ctx, now);
  return "ok";
}

/** "Table does not exist" (Postgres 42P01, PostgREST PGRST205) — never a missing column or anything else. */
function missingTable(e: { code?: string; message: string }): boolean {
  return e.code === "42P01" || e.code === "PGRST205" || /relation .* does not exist|could not find the table/i.test(e.message);
}

/** Before migration 0013 runs (the preview, until the parents merge) the tables do not exist. */
export async function worldReady(): Promise<boolean> {
  const { error } = await createAdminClient().from("world_items").select("id").limit(1);
  if (!error) return true;
  if (missingTable(error)) return false;
  throw new Error(`world.ready: ${error.message}`);
}

/** Best effort: null when there is no world for this child, the tables are not there yet, or anything fails. */
export async function feelGrowthToday(ctx: ChildContext, now = new Date()): Promise<FeelGrowth | null> {
  if (!hasWorld(ctx)) return null;
  try {
    const today = localDate(now);
    const month = monthOf(today);
    if (!worldStarted(month)) return null;
    const known = await knownWorlds(ctx.childId);
    const { key, choose } = worldOfMonth(month, true, known);
    if (!key) return choose.length > 0 ? { kind: "choose" } : null;
    const admin = createAdminClient();
    const [{ data, error }, visits] = await Promise.all([
      admin.from("world_items").select("local_date, pillar, world_key, item_key, variant").eq("child_id", ctx.childId).gte("local_date", firstDay(month)).lte("local_date", lastDay(month)),
      admin.from("by_checkins").select("id", { count: "exact", head: true }).eq("child_id", ctx.childId).eq("local_date", today),
    ]);
    if (error) throw new Error(`world.growth: ${error.message}`);
    if (visits.error) throw new Error(`world.growth.visits: ${visits.error.message}`);
    const view = monthView(month, key, (data ?? []) as WorldRow[], today);
    return view ? feelGrowthOf(view, (visits.count ?? 0) > 1) : null;
  } catch (e) {
    console.error("world.growth", e instanceof Error ? e.message : e);
    return null;
  }
}
