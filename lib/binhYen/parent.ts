import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Unseen "Con muốn nói chuyện" for this parent (their own session: RLS shows the family's
 * signals sent to both parents or to them). 0 before migration 0008.
 */
export async function unseenTalkCount(db: SupabaseClient): Promise<number> {
  const { count, error } = await db.from("by_signals").select("id", { count: "exact", head: true }).is("seen_at", null);
  return error ? 0 : (count ?? 0);
}
