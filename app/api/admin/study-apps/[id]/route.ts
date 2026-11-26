import { NextResponse } from "next/server";
import { z } from "zod";
import { firstIssue, isFamilyChild, jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";
import { STUDY_APP_TITLE_MAX } from "@/lib/studyApps";

const patchSchema = z
  .object({
    title: z.string().trim().min(1, "Đặt tên cho app.").max(STUDY_APP_TITLE_MAX, `Tên app tối đa ${STUDY_APP_TITLE_MAX} ký tự.`).optional(),
    childId: z.union([z.uuid(), z.null()]).optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => v.title !== undefined || v.childId !== undefined || v.active !== undefined, "Không có gì để lưu.");

/** Parent renames an app, changes who it is for, or turns it on / off (the file stays). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return jsonError("Không tìm thấy app.", 404);

  const parsed = patchSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
  const v = parsed.data;
  if (v.childId && !(await isFamilyChild(ctx.db, v.childId))) return jsonError("Không tìm thấy tài khoản con.", 400);

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (v.title !== undefined) row.title = v.title;
  if (v.childId !== undefined) row.child_id = v.childId;
  if (v.active !== undefined) row.active = v.active;

  const { data, error } = await ctx.db.from("study_apps").update(row).eq("id", id.data).select("id");
  if (error) {
    console.error("study_app.update failed", error.message);
    return jsonError("Không lưu được app.", 500);
  }
  if (!data || data.length === 0) return jsonError("Không tìm thấy app.", 404);

  await writeAudit(ctx, "study_app.update", { id: id.data, ...row });
  return NextResponse.json({ ok: true });
}
