import { NextResponse } from "next/server";
import { jsonError, requireChild, serverError } from "@/lib/today/service";
import { hasWorld, readRecent, worldReady } from "@/lib/world/service";

export const dynamic = "force-dynamic";

const NOT_READY = "Thế giới của con sẽ mở sau khi bố mẹ cập nhật app.";

/**
 * R7b: "Nhìn lại 7 ngày" for Góc bình yên's side column — what grew in An's world and who came
 * in the last 7 days. Child session only (a parent gets 403: the "feel" plants belong to Góc
 * bình yên), scientist voice only (404 otherwise, like /api/world). No feelings are sent: only
 * the world's things, visitors and the facts the child has already opened. Never cached.
 */
export async function GET() {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  if (!hasWorld(ctx)) return jsonError("Thế giới của tháng chưa có cho con.", 404);
  try {
    if (!(await worldReady())) return jsonError(NOT_READY, 503);
    const recent = await readRecent(ctx);
    if (!recent) return jsonError(NOT_READY, 503);
    return NextResponse.json(recent, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return serverError("world.recent", e);
  }
}
