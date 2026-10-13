import { NextResponse } from "next/server";
import { slotSchema, slotToRow } from "@/lib/admin/schemas";
import { firstIssue, isFamilyChild, jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";

/** Parent adds an app slot (a subject app; its domains join the allowlist). */
export async function POST(request: Request) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = slotSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
  if (parsed.data.childId && !(await isFamilyChild(ctx.db, parsed.data.childId))) {
    return jsonError("Không tìm thấy tài khoản con.", 400);
  }

  const row = { ...slotToRow(parsed.data), family_id: ctx.familyId };
  const { data, error } = await ctx.db.from("app_slots").insert(row).select("id").single();
  if (error || !data) {
    console.error("slot.create failed", error?.message);
    return jsonError("Không lưu được app.", 500);
  }
  await writeAudit(ctx, "slot.create", { id: data.id, ...row });
  return NextResponse.json({ ok: true, id: data.id });
}
