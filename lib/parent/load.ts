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

/** Parent's verdicts on today's runs (RLS: this family only). */
export async function loadVerdicts(db: SupabaseClient, date: string): Promise<Map<string, Verdict>> {
  const { data } = await db.from("task_runs").select("id, parent_verdict").eq("local_date", date);
  return new Map((data ?? []).map((r) => [r.id as string, (r.parent_verdict as Verdict) ?? null]));
}

/** Each child's live day (server clock), read with the parent's own session. Display only. */
export async function loadChildrenToday(db: SupabaseClient, familyId: string, children: ChildSummary[], today: string, now: Date): Promise<ChildToday[]> {
  const verdicts = await loadVerdicts(db, today);
  return Promise.all(
    children.map(async (child) => {
      try {
        const { input } = await loadDay(db, child.id, familyId, today);
        const state = computeDayState(input, now);
        return { child, state, overview: childOverview(state, verdicts, now) };
      } catch (e) {
        console.error("parent overview failed", e instanceof Error ? e.message : e);
        return { child, state: null, overview: null };
      }
    }),
  );
}
