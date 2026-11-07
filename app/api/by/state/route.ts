import { byFailed, byJson } from "@/lib/binhYen/http";
import { byState } from "@/lib/binhYen/session";
import { escalateSoon } from "@/lib/binhYen/talk";
import { requireChild } from "@/lib/today/service";

export const dynamic = "force-dynamic";

/**
 * Góc bình yên state for the child's screen. A PEEK: it never starts a visit nor keeps one
 * going (POST /api/by/open, /api/by/ping do that), so it can be asked at any time.
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
