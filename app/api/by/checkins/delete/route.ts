import { deleteBodySchema } from "@/lib/binhYen/checkin";
import { deleteCheckins } from "@/lib/binhYen/checkins";
import { byFailed, byJson, requireByOpen } from "@/lib/binhYen/http";
import { requireChild } from "@/lib/today/service";

/**
 * The child deletes one visit, or "Xóa hết của con" (Q7): a HARD delete, only of their own
 * rows, only from inside an open Góc bình yên session. Parents have no such button (§3).
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const parsed = deleteBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return byJson({ error: "Yêu cầu không hợp lệ." }, 400);
  try {
    const open = await requireByOpen(guard.ctx, true);
    if (!open.ok) return open.response;
    return byJson({ deleted: await deleteCheckins(guard.ctx, parsed.data) });
  } catch {
    return byFailed("checkins.delete");
  }
}
