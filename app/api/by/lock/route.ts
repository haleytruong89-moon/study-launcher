import { byFailed, byJson } from "@/lib/binhYen/http";
import { byState, endBySession } from "@/lib/binhYen/session";
import { requireChild } from "@/lib/today/service";

/** "Khóa lại" (or the screen's own idle timer): ends this browser's session. */
export async function POST() {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  try {
    await endBySession(guard.ctx);
    const state = await byState(guard.ctx, "api", false);
    return byJson({ ...state, unlocked: false });
  } catch {
    return byFailed("lock");
  }
}
