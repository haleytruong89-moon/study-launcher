import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPairCode, hashToken, newDeviceToken, PAIR_CODE_MAX_ATTEMPTS, sameHash } from "@/lib/ext/secrets";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, requireChild, serverError } from "@/lib/today/service";

const bodySchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Mã gồm 6 chữ số."),
  label: z.string().trim().max(60).optional(),
});

/**
 * The child's laptop (signed in as the child) exchanges the parent's 6-digit code for a
 * device token. The page hands the token to the extension; the server keeps only its hash.
 * A code works once, for 10 minutes, at most 5 tries, and only for that child.
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Mã không hợp lệ.", 400);

  try {
    const admin = createAdminClient();
    const now = new Date();
    const { data: row, error } = await admin
      .from("device_pair_codes")
      .select("id, code_hash, expires_at, attempts")
      .eq("child_id", ctx.childId)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || new Date(row.expires_at).getTime() <= now.getTime()) {
      return jsonError("Mã đã hết hạn hoặc chưa có. Nhờ bố mẹ tạo mã mới.", 400);
    }
    if (row.attempts >= PAIR_CODE_MAX_ATTEMPTS) return jsonError("Nhập sai quá nhiều lần. Nhờ bố mẹ tạo mã mới.", 429);

    if (!sameHash(row.code_hash, hashPairCode(ctx.childId, parsed.data.code))) {
      await admin.from("device_pair_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return jsonError(`Mã chưa đúng (còn ${PAIR_CODE_MAX_ATTEMPTS - row.attempts - 1} lần thử).`, 400);
    }

    // Use the code exactly once (guarded update: a second request finds nothing to update).
    const used = await admin.from("device_pair_codes").update({ used_at: now.toISOString() }).eq("id", row.id).is("used_at", null).select("id");
    if (used.error) throw new Error(used.error.message);
    if (!used.data || used.data.length === 0) return jsonError("Mã đã được dùng.", 409);

    const token = newDeviceToken();
    const { error: insErr } = await admin.from("extension_devices").insert({
      family_id: ctx.familyId,
      child_id: ctx.childId,
      token_hash: hashToken(token),
      label: parsed.data.label || "Laptop",
    });
    if (insErr) throw new Error(insErr.message);
    await admin.from("audit_log").insert({ family_id: ctx.familyId, actor_id: ctx.childId, action: "device.pair", payload: { label: parsed.data.label ?? null } });
    return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return serverError("ext.pair", e);
  }
}
