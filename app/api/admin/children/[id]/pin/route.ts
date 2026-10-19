import { NextResponse } from "next/server";
import { z } from "zod";
import { isFamilyChild, jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";
import { hashPin } from "@/lib/pin/hash";
import { pinProblem } from "@/lib/pin/rules";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Parent sets (or changes) a child's 6-digit PIN. Only a salted hash is stored, in the
 * profile column browsers can never read; a new PIN also clears any lock. The family check
 * runs first with the parent's own session (RLS); the write needs service_role.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const id = z.uuid().safeParse((await params).id);
  if (!id.success || !(await isFamilyChild(ctx.db, id.data))) return jsonError("Không tìm thấy tài khoản con.", 404);
  const body = z.object({ pin: z.string() }).safeParse(await readJson(request));
  const pin = body.success ? body.data.pin.trim() : "";
  const problem = pinProblem(pin);
  if (problem) return jsonError(problem, 400);

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ pin_hash: await hashPin(pin), pin_failed_count: 0, pin_locked_until: null })
    .eq("id", id.data)
    .eq("role", "child");
  if (error) {
    console.error("child.pin_set failed", error.message);
    return jsonError("Không lưu được PIN.", 500);
  }
  await writeAudit(ctx, "child.pin_set", { child_id: id.data });
  return NextResponse.json({ ok: true });
}
