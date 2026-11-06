import { byFailed, byJson } from "@/lib/binhYen/http";
import { byState } from "@/lib/binhYen/session";
import { requireChild } from "@/lib/today/service";

/** The child touched the screen: keeps an open session alive (server clock). Body is ignored. */
export async function POST() {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  try {
    return byJson(await byState(guard.ctx, "api", true));
  } catch {
    return byFailed("ping");
  }
}
