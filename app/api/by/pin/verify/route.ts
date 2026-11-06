import { z } from "zod";
import { byFailed, byJson } from "@/lib/binhYen/http";
import { byLockedMessage, byWrongPinMessage } from "@/lib/binhYen/rules";
import { bySettings, byState, pinInfo, startBySession } from "@/lib/binhYen/session";
import { verifyPin } from "@/lib/pin/hash";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireChild } from "@/lib/today/service";

const bodySchema = z.object({ pin: z.string().regex(/^\d{6}$/) });

/**
 * Opens Góc bình yên with the child's own PIN (R6). Each try is counted ATOMICALLY before the
 * comparison (by_pin_try): 5 wrong in a row → locked 15 minutes. No audit_log (D5).
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return byJson({ error: "Nhập đủ 6 số." }, 400);

  try {
    const now = new Date();
    if (!(await bySettings(ctx.familyId)).enabled) return byJson({ error: "Góc bình yên chưa mở." }, 409);
    const admin = createAdminClient();
    const { data: tryNo, error: tryErr } = await admin.rpc("by_pin_try", { p_child: ctx.childId });
    if (tryErr) throw new Error("try");
    if (tryNo === null) {
      const info = await pinInfo(ctx.childId, now);
      if (!info.hasPin) return byJson({ error: "Con chưa đặt PIN Góc bình yên." }, 409);
      return byJson({ error: byLockedMessage(info.lockedUntil ?? now.toISOString()), state: await byState(ctx, "api", false, now) }, 429);
    }
    const { data: me, error: readErr } = await admin.from("profiles").select("by_pin_hash").eq("id", ctx.childId).single();
    if (readErr) throw new Error("read");
    if (!(await verifyPin(parsed.data.pin, (me.by_pin_hash as string | null) ?? null))) {
      return byJson({ error: byWrongPinMessage(tryNo as number), state: await byState(ctx, "api", false, now) }, 401);
    }
    const { error: resetErr } = await admin.from("profiles").update({ by_pin_failed_count: 0, by_pin_locked_until: null }).eq("id", ctx.childId);
    if (resetErr) throw new Error("reset");
    await startBySession(ctx, now);
    return byJson({ ...(await byState(ctx, "api", false, now)), unlocked: true });
  } catch {
    return byFailed("pin.verify");
  }
}
