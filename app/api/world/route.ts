import { NextResponse } from "next/server";
import { jsonError, requireChild, serverError } from "@/lib/today/service";
import { isMonth, seedParam, type SeedProgress } from "@/lib/world/rules";
import { hasWorld, readWorld, syncWorld, worldReady } from "@/lib/world/service";

export const dynamic = "force-dynamic";

/**
 * R4: the child's world of the month (?month=YYYY-MM for an album month). Child session only:
 * world_items has no browser grant and parents have no route to it (the "feel" plants belong to
 * Góc bình yên). Reading also plants what grew since last time, from the durable records.
 */
export async function GET(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  if (!hasWorld(ctx)) return jsonError("Thế giới của tháng chưa có cho con.", 404);
  const params = new URL(request.url).searchParams;
  const month = params.get("month");
  if (month !== null && !isMonth(month)) return jsonError("Tháng không hợp lệ.", 400);

  try {
    if (!(await worldReady())) return jsonError("Thế giới của con sẽ mở sau khi bố mẹ cập nhật app.", 503);
    await syncWorld(ctx);
    // 18/11/2026: the child's own screen says how far each part is ("2/3"), so the seed of the
    // plant to come opens little by little. Display only: what grows stays server-decided.
    const world = await readWorld(ctx, month, undefined, { study: seedParam(params.get("hoc")), skill: seedParam(params.get("kn")) } satisfies SeedProgress);
    if (!world) return jsonError("Không có tháng này.", 404);
    return NextResponse.json(world, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return serverError("world.read", e);
  }
}

