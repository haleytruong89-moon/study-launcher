import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireChild, serverError } from "@/lib/today/service";
import { chooseWorld, hasWorld, readWorld, worldReady } from "@/lib/world/service";

const bodySchema = z.object({ world: z.string().regex(/^[a-z][a-z0-9_]{1,31}$/), month: z.string().regex(/^\d{4}-\d{2}$/).optional() }).strict();

/**
 * R4b: An picks the world of this month (docs/world/README.md decision 3). Child session only;
 * once picked (or once the month has plants) the world stays for the whole month.
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  if (!hasWorld(ctx)) return jsonError("Thế giới của tháng chưa có cho con.", 404);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Thiếu tên thế giới.", 400);

  try {
    if (!(await worldReady())) return jsonError("Thế giới của con sẽ mở sau khi bố mẹ cập nhật app.", 503);
    const result = await chooseWorld(ctx, parsed.data.world, parsed.data.month);
    if (result === "not_offered") return jsonError("Thế giới này chưa chọn được tháng này.", 400);
    if (result === "already") return jsonError("Tháng này con đã có thế giới rồi.", 409);
    return NextResponse.json(await readWorld(ctx, null), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return serverError("world.choose", e);
  }
}
