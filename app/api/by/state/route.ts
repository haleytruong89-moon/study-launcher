import { byFailed, byJson } from "@/lib/binhYen/http";
import { byState } from "@/lib/binhYen/session";
import { escalateSoon } from "@/lib/binhYen/talk";
import { requireChild } from "@/lib/today/service";

export const dynamic = "force-dynamic";

/**
 * Góc bình yên state for the child's screen. A PEEK: it does not count as activity, so the
 * screen can poll it and still lock after N idle minutes (server clock).
 */
export async function GET() {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  escalateSoon(guard.ctx.familyId);
  try {
    return byJson(await byState(guard.ctx, "api", false));
  } catch {
    return byFailed("state");
  }
}
