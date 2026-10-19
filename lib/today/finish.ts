import "server-only";
import type { TaskView } from "@/lib/dayState";
import { createAdminClient } from "@/lib/supabase/admin";

/** Marks a run (and its homework) done at `now`. Callers decide first (decideFinish). */
export async function writeFinish(childId: string, item: TaskView, runId: string, now: Date): Promise<void> {
  const admin = createAdminClient();
  const doneAt = now.toISOString();
  const { error: runError } = await admin.from("task_runs").update({ done_at: doneAt }).eq("id", runId).eq("child_id", childId).is("done_at", null);
  if (runError) throw new Error(runError.message);
  if (item.source === "homework") {
    const { error } = await admin.from("homework_items").update({ done_at: doneAt }).eq("id", item.id).eq("child_id", childId).is("done_at", null);
    if (error) throw new Error(error.message);
  }
}
