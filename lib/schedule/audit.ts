import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type ScheduleAction = "schedule.timetable" | "schedule.extra.save" | "schedule.extra.off";

/**
 * One audit_log row per change the CHILD makes (server-written only; parents read it in Nhật ký
 * and can restore the `before`). Logging never breaks the child's save.
 */
export async function scheduleAudit(familyId: string, actorId: string, action: ScheduleAction, payload: Record<string, unknown>) {
  try {
    const { error } = await createAdminClient().from("audit_log").insert({ family_id: familyId, actor_id: actorId, action, payload });
    if (error) console.error("audit_log insert failed", action, error.message);
  } catch (e) {
    console.error("audit_log insert failed", action, e instanceof Error ? e.message : e);
  }
}
