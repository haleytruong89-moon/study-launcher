import { NextResponse } from "next/server";
import { templateSchema, templateToRow } from "@/lib/admin/schemas";
import { firstIssue, jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";
import { checkTemplateRefs } from "./refs";

/** Parent adds a task template (supplementary work or a skill, on chosen weekdays). */
export async function POST(request: Request) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = templateSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
  const refError = await checkTemplateRefs(ctx.db, parsed.data);
  if (refError) return jsonError(refError, 400);

  const row = { ...templateToRow(parsed.data), family_id: ctx.familyId };
  const { data, error } = await ctx.db.from("task_templates").insert(row).select("id").single();
  if (error || !data) {
    console.error("template.create failed", error?.message);
    return jsonError("Không lưu được việc.", 500);
  }
  await writeAudit(ctx, "template.create", { id: data.id, ...row });
  return NextResponse.json({ ok: true, id: data.id });
}
