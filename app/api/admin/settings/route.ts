import { NextResponse } from "next/server";
import { settingsSchema, settingsToRow } from "@/lib/admin/schemas";
import { firstIssue, isFamilyChild, jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";

/** Parent saves the family rules (family_settings) and each child's bedtime. */
export async function PUT(request: Request) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = settingsSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
  const input = parsed.data;

  for (const b of input.bedtimes) {
    if (!(await isFamilyChild(ctx.db, b.childId))) return jsonError("Không tìm thấy tài khoản con.", 400);
  }

  const { data: updated, error } = await ctx.db
    .from("family_settings")
    .update(settingsToRow(input))
    .eq("family_id", ctx.familyId)
    .select("family_id");
  if (error || !updated || updated.length !== 1) {
    console.error("settings.update failed", error?.message);
    return jsonError("Không lưu được cài đặt.", 500);
  }

  for (const b of input.bedtimes) {
    const { error: bedErr } = await ctx.db.from("profiles").update({ bedtime: b.bedtime }).eq("id", b.childId);
    if (bedErr) {
      console.error("settings.bedtime failed", bedErr.message);
      return jsonError("Không lưu được giờ ngủ.", 500);
    }
  }

  await writeAudit(ctx, "settings.update", { settings: settingsToRow(input), bedtimes: input.bedtimes });
  return NextResponse.json({ ok: true });
}
