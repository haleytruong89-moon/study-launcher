import { NextResponse } from "next/server";
import { z } from "zod";
import { childProfileSchema } from "@/lib/admin/schemas";
import { firstIssue, isFamilyChild, jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";

/** Parent edits a child's display name, grade and colour (RLS: parent of the same family). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const id = z.uuid().safeParse((await params).id);
  if (!id.success || !(await isFamilyChild(ctx.db, id.data))) return jsonError("Không tìm thấy tài khoản con.", 404);

  const parsed = childProfileSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);

  const row = { display_name: parsed.data.displayName, grade: parsed.data.grade, color: parsed.data.color };
  const { data, error } = await ctx.db.from("profiles").update(row).eq("id", id.data).eq("role", "child").select("id");
  if (error) {
    console.error("child.update failed", error.message);
    return jsonError("Không lưu được.", 500);
  }
  if (!data || data.length === 0) return jsonError("Không tìm thấy tài khoản con.", 404);

  await writeAudit(ctx, "child.update", { child_id: id.data, ...row });
  return NextResponse.json({ ok: true });
}
