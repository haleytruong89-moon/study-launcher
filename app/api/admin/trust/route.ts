import { NextResponse } from "next/server";
import { firstIssue, isFamilyChild, jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";
import { TRUST_DISMISSED, TRUST_SET, trustBodySchema } from "@/lib/admin/trust";
import { localDate, weekStart } from "@/lib/time";

/**
 * "Chế độ Tin tưởng" (S3d, SPEC section 7): the PARENT switches a child between Khóa and Tin
 * tưởng, or taps "Để sau" on the weekly suggestion. The system only suggests; nothing here
 * runs on its own. Written with the parent's own session (RLS parent_all on trust_state);
 * children have no write path (no route accepts them, RLS gives them select only).
 * The lock/open effect is computeDayState row 3 (OPEN_TRUST), unchanged.
 */
export async function POST(request: Request) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = trustBodySchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
  const b = parsed.data;
  if (!(await isFamilyChild(ctx.db, b.childId))) return jsonError("Không tìm thấy tài khoản con.", 400);
  const now = new Date();

  if ("later" in b) {
    // "Để sau": only hides the card until next Monday (read back from audit_log).
    await writeAudit(ctx, TRUST_DISMISSED, { child_id: b.childId, suggestion: b.later, week: weekStart(localDate(now)) });
    return NextResponse.json({ ok: true });
  }

  const { data: before, error: readError } = await ctx.db.from("trust_state").select("mode").eq("child_id", b.childId).maybeSingle();
  if (readError) {
    console.error("trust read failed", readError.message);
    return jsonError("Không đọc được chế độ hiện tại, thử lại.", 500);
  }
  const previous = (before?.mode as string | undefined) ?? "lock";
  if (before && previous === b.mode) return NextResponse.json({ ok: true, mode: b.mode, changed: false });

  const { error } = await ctx.db
    .from("trust_state")
    .upsert({ child_id: b.childId, family_id: ctx.familyId, mode: b.mode, since: now.toISOString(), updated_by: ctx.userId }, { onConflict: "child_id" });
  if (error) {
    console.error("trust upsert failed", error.message);
    return jsonError("Không lưu được.", 500);
  }
  await writeAudit(ctx, TRUST_SET, { child_id: b.childId, mode: b.mode, previous, via: b.via });
  return NextResponse.json({ ok: true, mode: b.mode, changed: true });
}
