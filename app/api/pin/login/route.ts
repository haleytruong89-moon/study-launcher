import { NextResponse } from "next/server";
import { z } from "zod";
import { hashToken } from "@/lib/ext/secrets";
import { verifyPin } from "@/lib/pin/hash";
import { deviceToken } from "@/lib/pin/device";
import { PIN_LOCK_MINUTES, wrongPinMessage } from "@/lib/pin/rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({ childId: z.uuid(), pin: z.string().regex(/^\d{6}$/) });

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * Child signs in with the 6-digit PIN (parent decision 19/10/2026). Only on a browser
 * remembered for THAT child (httpOnly cookie, set after a real password login), so the PIN
 * alone is useless from anywhere else. 5 wrong tries in a row lock it for 15 minutes,
 * counted atomically BEFORE the comparison. On success the server opens the child's session
 * (a one-time sign-in token that never leaves the server).
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Nhập đủ 6 số.", 400);
  const { childId, pin } = parsed.data;

  const token = await deviceToken();
  if (!token) return fail("Máy này chưa được nhớ. Đăng nhập bằng email một lần trước.", 403);

  try {
    const admin = createAdminClient();
    const { data: device, error: devErr } = await admin
      .from("pin_devices")
      .select("id, family_id")
      .eq("token_hash", hashToken(token))
      .eq("child_id", childId)
      .is("revoked_at", null)
      .maybeSingle();
    if (devErr) throw new Error(devErr.message);
    if (!device) return fail("Máy này chưa được nhớ cho tài khoản này. Đăng nhập bằng email một lần trước.", 403);

    const { data: tryNo, error: tryErr } = await admin.rpc("child_pin_try", { p_child: childId });
    if (tryErr) throw new Error(tryErr.message);
    if (tryNo === null) {
      const { data: p } = await admin.from("profiles").select("pin_hash, pin_locked_until").eq("id", childId).maybeSingle();
      if (!p?.pin_hash) return fail("Bố mẹ chưa đặt PIN cho con. Đăng nhập bằng email.", 409);
      return fail(`PIN đang bị khóa ${PIN_LOCK_MINUTES} phút vì sai nhiều lần. Thử lại sau, hoặc nhờ bố mẹ.`, 429);
    }

    const { data: profile, error: readErr } = await admin.from("profiles").select("pin_hash").eq("id", childId).single();
    if (readErr) throw new Error(readErr.message);
    if (!(await verifyPin(pin, profile.pin_hash as string | null))) {
      await audit(admin, device.family_id as string, childId, "pin.login_failed", { try: tryNo });
      return fail(wrongPinMessage(tryNo as number), 401);
    }

    const { error: resetErr } = await admin.from("profiles").update({ pin_failed_count: 0, pin_locked_until: null }).eq("id", childId);
    if (resetErr) throw new Error(resetErr.message);

    const { data: user, error: userErr } = await admin.auth.admin.getUserById(childId);
    if (userErr || !user.user?.email) throw new Error(userErr?.message ?? "child has no email");
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.user.email });
    if (linkErr || !link.properties?.hashed_token) throw new Error(linkErr?.message ?? "no sign-in token");
    const { error: otpErr } = await (await createClient()).auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
    if (otpErr) throw new Error(otpErr.message);

    await admin.from("pin_devices").update({ last_used_at: new Date().toISOString() }).eq("id", device.id);
    await audit(admin, device.family_id as string, childId, "pin.login", {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("pin.login failed", e instanceof Error ? e.message : e);
    return fail("Máy chủ đang lỗi, thử lại sau ít phút.", 500);
  }
}

async function audit(admin: ReturnType<typeof createAdminClient>, familyId: string, childId: string, action: string, payload: Record<string, unknown>) {
  const { error } = await admin.from("audit_log").insert({ family_id: familyId, actor_id: childId, action, payload: { child_id: childId, ...payload } });
  if (error) console.error("pin audit failed", error.message);
}
