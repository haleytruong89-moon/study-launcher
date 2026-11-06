import { z } from "zod";
import { byFailed, byJson } from "@/lib/binhYen/http";
import { byPinProblem } from "@/lib/binhYen/rules";
import { bySettings, byState, pinInfo, startBySession } from "@/lib/binhYen/session";
import { hashPin, verifyPin } from "@/lib/pin/hash";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireChild } from "@/lib/today/service";

const bodySchema = z.object({ pin: z.string().max(12), again: z.string().max(12) });

/**
 * The child sets their OWN Góc bình yên PIN (Q1), only when none is set (a parent's wipe is
 * the only way to start over). It must differ from the login PIN the parents know. Only a
 * salted scrypt hash is stored, in a column no browser can read. No audit_log (D5).
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return byJson({ error: "Nhập đủ 6 số, hai lần." }, 400);
  const pin = parsed.data.pin.trim();
  const again = parsed.data.again.trim();

  try {
    const now = new Date();
    if (!(await bySettings(ctx.familyId)).enabled) return byJson({ error: "Góc bình yên chưa mở." }, 409);
    if ((await pinInfo(ctx.childId, now)).hasPin) return byJson({ error: "Con đã có PIN Góc bình yên rồi." }, 409);

    const admin = createAdminClient();
    const { data: me, error: readErr } = await admin.from("profiles").select("pin_hash").eq("id", ctx.childId).single();
    if (readErr) throw new Error("read");
    // Compared on the server only; the child knows the login PIN already, so the answer reveals nothing new.
    const sameAsLogin = /^\d{6}$/.test(pin) ? await verifyPin(pin, (me.pin_hash as string | null) ?? null) : false;
    const problem = byPinProblem(pin, again, sameAsLogin);
    if (problem) return byJson({ error: problem }, 400);

    const { data: saved, error } = await admin
      .from("profiles")
      .update({ by_pin_hash: await hashPin(pin), by_pin_failed_count: 0, by_pin_locked_until: null })
      .eq("id", ctx.childId)
      .eq("role", "child")
      .is("by_pin_hash", null)
      .select("id");
    if (error) throw new Error("update");
    if (!saved?.length) return byJson({ error: "Con đã có PIN Góc bình yên rồi." }, 409);

    await startBySession(ctx, now);
    return byJson({ ...(await byState(ctx, "api", false, now)), unlocked: true });
  } catch {
    return byFailed("pin.set");
  }
}
