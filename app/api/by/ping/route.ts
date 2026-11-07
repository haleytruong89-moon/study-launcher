import { byFailed, byJson } from "@/lib/binhYen/http";
import { byState } from "@/lib/binhYen/session";
import { requireChild } from "@/lib/today/service";

/** The corner is still on screen: the visit goes on (server clock, last_seen_at). Body is ignored. */
export async function POST() {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  try {
    return byJson(await byState(guard.ctx, "api", true));
  } catch {
    return byFailed("ping");
  }
}
