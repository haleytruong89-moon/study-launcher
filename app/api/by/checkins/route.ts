import { findWord, voiceFor } from "@/lib/binhYen/catalog";
import { checkinBodySchema, checkinProblem } from "@/lib/binhYen/checkin";
import { recentCheckins, saveCheckin } from "@/lib/binhYen/checkins";
import { byFailed, byJson, requireByOpen } from "@/lib/binhYen/http";
import { requireChild } from "@/lib/today/service";
import { feelGrowthToday, syncWorldQuietly } from "@/lib/world/service";

export const dynamic = "force-dynamic";

/** "Lần ghé gần đây": the child's own last visits. Needs an open Góc bình yên session. */
export async function GET() {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  try {
    const open = await requireByOpen(guard.ctx, false);
    if (!open.ok) return open.response;
    return byJson({ recent: await recentCheckins(guard.ctx, voiceFor(guard.ctx.grade)), study: open.state.study, serverNow: open.state.serverNow });
  } catch {
    return byFailed("checkins.list");
  }
}

/**
 * "Xong" (or "Vậy là đủ cho hôm nay"): stores ONE finished visit — keys only, never text (D1).
 * Validated against the catalog BEFORE the database is touched (D5). A second tap with the same
 * clientRunId stores nothing new. No audit_log, no console output of the values (D5).
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const parsed = checkinBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return byJson({ error: "Yêu cầu không hợp lệ." }, 400);
  const problem = checkinProblem(voiceFor(guard.ctx.grade), parsed.data);
  if (problem) return byJson({ error: problem }, 400);
  try {
    const open = await requireByOpen(guard.ctx, true);
    if (!open.ok) return open.response;
    const result = await saveCheckin(guard.ctx, parsed.data);
    if (!result) return byJson({ error: "Yêu cầu không hợp lệ." }, 409);
    // R4: a finished visit grows a flower in An's world right away (best effort; the world also
    // catches up when it is opened). The plant is the same whatever the child felt.
    const now = new Date();
    const planted = await syncWorldQuietly(guard.ctx, now);
    // R5: Nguyên's "Xong rồi" draws frame 1 of today's comic page. Only the keys the child just
    // sent (already validated against the catalog) go back: no new data leaves the server.
    const comic =
      voiceFor(guard.ctx.grade) === "detective"
        ? { quad: parsed.data.quad, word: parsed.data.word, label: findWord(parsed.data.word)?.label ?? "", activity: parsed.data.activity ?? null }
        : null;
    // R6a: tell the "Xong rồi" screen what grew (null for Nguyên, before migration 0013, on error).
    return byJson({ ...result, world: await feelGrowthToday(guard.ctx, planted, now), comic });
  } catch {
    return byFailed("checkins.save");
  }
}
