import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Unread "Góp ý của con" for the menu row (parent's own session, RLS). 0 before migration 0010. */
export async function unreadFeedbackCount(db: SupabaseClient): Promise<number> {
  const { count, error } = await db.from("app_feedback").select("id", { count: "exact", head: true }).is("seen_at", null);
  return error ? 0 : (count ?? 0);
}
