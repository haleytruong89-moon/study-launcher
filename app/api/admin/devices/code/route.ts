import { NextResponse } from "next/server";
import { z } from "zod";
import { isFamilyChild, jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";
import { hashPairCode, newPairCode, PAIR_CODE_MINUTES } from "@/lib/ext/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({ childId: z.uuid() });

/**
 * Parent asks for a pairing code for one child's laptop (S4b, parent decision 17/10/2026).
 * The 6 digits are shown ONCE on the parent's phone; only a hash is stored, valid
 * 10 minutes, 5 tries. A new code cancels the child's older unused codes.
 */
export async function POST(request: Request) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("Thiếu tài khoản con.", 400);
  const { childId } = parsed.data;
  if (!(await isFamilyChild(ctx.db, childId))) return jsonError("Không tìm thấy tài khoản con.", 400);

  const admin = createAdminClient();
  const now = new Date();
  const cancel = await admin.from("device_pair_codes").update({ used_at: now.toISOString() }).eq("child_id", childId).is("used_at", null);
  if (cancel.error) {
    console.error("pair code cancel failed", cancel.error.message);
    return jsonError("Không tạo được mã, thử lại.", 500);
  }
  const code = newPairCode();
  const expiresAt = new Date(now.getTime() + PAIR_CODE_MINUTES * 60_000).toISOString();
  const { error } = await admin.from("device_pair_codes").insert({
    family_id: ctx.familyId,
    child_id: childId,
    code_hash: hashPairCode(childId, code),
    expires_at: expiresAt,
    created_by: ctx.userId,
  });
  if (error) {
    console.error("pair code insert failed", error.message);
    return jsonError("Không tạo được mã, thử lại.", 500);
  }
  await writeAudit(ctx, "device.code", { child_id: childId, expires_at: expiresAt });
  return NextResponse.json({ code, expiresAt }, { headers: { "Cache-Control": "no-store" } });
}
