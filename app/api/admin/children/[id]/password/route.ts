import { NextResponse } from "next/server";
import { z } from "zod";
import { isFamilyChild, jsonError, requireParent, writeAudit } from "@/lib/admin/guard";
import { generatePassword } from "@/lib/children";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Parent resets a child's password (e.g. it was shown to someone by mistake).
 * The new password is returned ONCE and never stored in clear. Changing auth credentials
 * needs service_role, so the family check runs first with the parent's own session (RLS).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const id = z.uuid().safeParse((await params).id);
  if (!id.success || !(await isFamilyChild(ctx.db, id.data))) return jsonError("Không tìm thấy tài khoản con.", 404);

  const admin = createAdminClient();
  const password = generatePassword();
  const { data, error } = await admin.auth.admin.updateUserById(id.data, { password });
  if (error || !data.user) {
    console.error("child.password_reset failed", error?.message);
    return jsonError("Không đặt lại được mật khẩu.", 500);
  }

  await writeAudit(ctx, "child.password_reset", { child_id: id.data });
  return NextResponse.json({ ok: true, email: data.user.email, password });
}
