import { NextResponse } from "next/server";
import { z } from "zod";
import { homeworkPatchSchema } from "@/lib/admin/schemas";
import { jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";

/**
 * Parent archives (or restores) a homework item, e.g. one assigned by mistake.
 * Archiving hides it from the child's Part 1; nothing is deleted.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return jsonError("Không tìm thấy bài.", 404);
  const parsed = homeworkPatchSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("Thiếu hoặc sai thông tin.", 400);

  const archivedAt = parsed.data.archived ? new Date().toISOString() : null;
  const { data, error } = await ctx.db
    .from("homework_items")
    .update({ archived_at: archivedAt })
    .eq("id", id.data)
    .select("id");
  if (error) {
    console.error("homework.archive failed", error.message);
    return jsonError("Không lưu được.", 500);
  }
  if (!data || data.length === 0) return jsonError("Không tìm thấy bài.", 404);

  await writeAudit(ctx, parsed.data.archived ? "homework.archive" : "homework.restore", { id: id.data });
  return NextResponse.json({ ok: true });
}
