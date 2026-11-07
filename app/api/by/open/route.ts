import { byFailed, byJson } from "@/lib/binhYen/http";
import { openByVisit } from "@/lib/binhYen/session";
import { requireChild } from "@/lib/today/service";

export const dynamic = "force-dynamic";

/**
 * The child opens Góc bình yên (parent decision 07/11/2026: no separate PIN — the child's own
 * login is enough). Continues this browser's visit, or starts a new one (server clock, R5).
 * Body is ignored. Nothing is logged (D5).
 */
export async function POST() {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  try {
    return byJson(await openByVisit(guard.ctx));
  } catch {
    return byFailed("open");
  }
}
