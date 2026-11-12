import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChildSummary } from "@/lib/admin/page";
import { computeDayState, type DayState } from "@/lib/dayState";
import { loadDay } from "@/lib/today/load";
import { childOverview, type ChildOverview, type Verdict } from "./overview";

export interface ChildToday {
  child: ChildSummary;
  state: DayState | null;
  overview: ChildOverview | null;
}

/** Parent's verdicts on today's runs, and the open "Nhờ bố mẹ xem" requests (RLS: this family only). */
export async function loadVerdicts(db: SupabaseClient, date: string): Promise<{ verdicts: Map<string, Verdict>; asked: Set<string> }> {
  const full = await db.from("task_runs").select("id, parent_verdict, confirm_requested_at, done_at").eq("local_date", date);
  // Before migration 0006 there is no confirm column: fall back to the verdicts only.
  type Row = { id: string; parent_verdict: string | null; confirm_requested_at?: string | null; done_at?: string | null };
  const rows: Row[] = full.error ? (((await db.from("task_runs").select("id, parent_verdict").eq("local_date", date)).data ?? []) as Row[]) : ((full.data ?? []) as Row[]);
  return {
    verdicts: new Map(rows.map((r) => [r.id as string, (r.parent_verdict as Verdict) ?? null])),
    asked: new Set(rows.filter((r) => r.confirm_requested_at && !r.done_at).map((r) => r.id)),
  };
}

/** Each child's live day (server clock), read with the parent's own session. Display only. */
export async function loadChildrenToday(db: SupabaseClient, familyId: string, children: ChildSummary[], today: string, now: Date): Promise<ChildToday[]> {
  // The verdicts and each child's day are independent reads: all at once. A verdicts error
  // still fails the whole call; a child's day error still only blanks that child's card.
  const days = children.map((child) =>
    loadDay(db, child.id, familyId, today).then(
      ({ input }) => ({ ok: true as const, input }),
      (e: unknown) => ({ ok: false as const, e }),
    ),
  );
  const [{ verdicts, asked }, loaded] = await Promise.all([loadVerdicts(db, today), Promise.all(days)]);
  return children.map((child, i) => {
    try {
      const day = loaded[i]!;
      if (!day.ok) throw day.e;
      const state = computeDayState(day.input, now);
      return { child, state, overview: childOverview(state, verdicts, now, asked) };
    } catch (e) {
      console.error("parent overview failed", e instanceof Error ? e.message : e);
      return { child, state: null, overview: null };
    }
  });
}
