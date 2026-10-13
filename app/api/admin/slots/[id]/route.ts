import { NextResponse } from "next/server";
import { z } from "zod";
import { slotSchema, slotToRow } from "@/lib/admin/schemas";
import { firstIssue, isFamilyChild, jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";

/** Parent edits a slot (full replace from the edit form, including turning it off). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return jsonError("Không tìm thấy app.", 404);

  const parsed = slotSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
  if (parsed.data.childId && !(await isFamilyChild(ctx.db, parsed.data.childId))) {
    return jsonError("Không tìm thấy tài khoản con.", 400);
  }

  const row = slotToRow(parsed.data);
  const { data, error } = await ctx.db.from("app_slots").update(row).eq("id", id.data).select("id");
  if (error) {
    console.error("slot.update failed", error.message);
    return jsonError("Không lưu được app.", 500);
  }
  if (!data || data.length === 0) return jsonError("Không tìm thấy app.", 404);

  await writeAudit(ctx, "slot.update", { id: id.data, ...row });
  return NextResponse.json({ ok: true });
}
