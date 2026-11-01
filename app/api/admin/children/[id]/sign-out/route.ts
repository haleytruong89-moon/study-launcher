import { NextResponse } from "next/server";
import { z } from "zod";
import { isFamilyChild, jsonError, requireParent, writeAudit } from "@/lib/admin/guard";
import { signOutChildEverywhere } from "@/lib/pin/device";

/**
 * "Đăng xuất con khỏi mọi máy" (audit 24/10): ends every session of the child and forgets
 * every browser remembered for PIN login. The family check runs first with the parent's
 * own session (RLS); the sign-out needs service_role.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const id = z.uuid().safeParse((await params).id);
  if (!id.success || !(await isFamilyChild(ctx.db, id.data))) return jsonError("Không tìm thấy tài khoản con.", 404);
  try {
    await signOutChildEverywhere(id.data, ctx.familyId, ctx.userId);
  } catch (e) {
    console.error("child.sign_out_all failed", e instanceof Error ? e.message : e);
    return jsonError("Không đăng xuất được, thử lại sau.", 500);
  }
  await writeAudit(ctx, "child.sign_out_all", { child_id: id.data });
  return NextResponse.json({ ok: true });
}
