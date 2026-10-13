import { NextResponse } from "next/server";
import { z } from "zod";
import { templateSchema, templateToRow } from "@/lib/admin/schemas";
import { firstIssue, jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";
import { checkTemplateRefs } from "../refs";

/** Parent edits a task template (full replace from the edit form, including turning it off). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return jsonError("Không tìm thấy việc.", 404);

  const parsed = templateSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
  const refError = await checkTemplateRefs(ctx.db, parsed.data);
  if (refError) return jsonError(refError, 400);

  const row = templateToRow(parsed.data);
  const { data, error } = await ctx.db.from("task_templates").update(row).eq("id", id.data).select("id");
  if (error) {
    console.error("template.update failed", error.message);
    return jsonError("Không lưu được việc.", 500);
  }
  if (!data || data.length === 0) return jsonError("Không tìm thấy việc.", 404);

  await writeAudit(ctx, "template.update", { id: id.data, ...row });
  return NextResponse.json({ ok: true });
}
