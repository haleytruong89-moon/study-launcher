import type { SupabaseClient } from "@supabase/supabase-js";
import { localDate } from "@/lib/time";

/**
 * What the children are waiting for (parent's red badge): "Xin mở trang" requests plus
 * today's "Nhờ bố mẹ xem trực tiếp". Read with the parent's session (RLS: own family).
 */
export async function pendingForParent(db: SupabaseClient): Promise<number> {
  const [unlock, confirm] = await Promise.all([
    db.from("unlock_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db
      .from("task_runs")
      .select("id", { count: "exact", head: true })
      .eq("local_date", localDate(new Date()))
      .not("confirm_requested_at", "is", null)
      .is("done_at", null),
  ]);
  // Before migration 0006 the second query fails: count only the unlock requests then.
  return (unlock.count ?? 0) + (confirm.error ? 0 : (confirm.count ?? 0));
}
