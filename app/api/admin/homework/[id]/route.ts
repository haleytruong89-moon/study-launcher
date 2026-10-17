import { NextResponse } from "next/server";
import { z } from "zod";
import { homeworkPatchSchema } from "@/lib/admin/schemas";
import { firstIssue, jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";
import { addDays } from "@/lib/admin/dates";
import { missingHomeworkFiles, pathsUsedElsewhere, removeHomeworkFiles } from "@/lib/admin/homework-files";
import { isHomeworkFilePath } from "@/lib/files";
import { localDate } from "@/lib/time";

/** Same sanity guard as creating: a new due date is today .. today + 60 days. */
const MAX_DAYS_AHEAD = 60;

/**
 * Parent changes a homework item (written with the parent's session, RLS):
 *  - { archived: boolean }: archive (hide from the child) or restore; nothing is deleted.
 *  - { subject, dueDate, note, photoPaths }: edit (S2c). A due date may stay as it was
 *    (even if already past); a NEW due date must be today or later. Files removed from the
 *    list are deleted from storage afterwards (best effort).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return jsonError("Không tìm thấy bài.", 404);
  const parsed = homeworkPatchSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
  const body = parsed.data;

  if ("archived" in body) {
    const archivedAt = body.archived ? new Date().toISOString() : null;
    const { data, error } = await ctx.db.from("homework_items").update({ archived_at: archivedAt }).eq("id", id.data).select("id");
    if (error) {
      console.error("homework.archive failed", error.message);
      return jsonError("Không lưu được.", 500);
    }
    if (!data || data.length === 0) return jsonError("Không tìm thấy bài.", 404);
    await writeAudit(ctx, body.archived ? "homework.archive" : "homework.restore", { id: id.data });
    return NextResponse.json({ ok: true });
  }

  const { data: current, error: readError } = await ctx.db
    .from("homework_items")
    .select("id, child_id, due_date, photo_paths")
    .eq("id", id.data)
    .maybeSingle();
  if (readError) {
    console.error("homework.edit read failed", readError.message);
    return jsonError("Không lưu được.", 500);
  }
  if (!current) return jsonError("Không tìm thấy bài.", 404);

  const today = localDate(new Date());
  if (body.dueDate !== current.due_date && (body.dueDate < today || body.dueDate > addDays(today, MAX_DAYS_AHEAD))) {
    return jsonError("Ngày phải nộp mới phải từ hôm nay trở đi.", 400);
  }

  const paths = [...new Set(body.photoPaths)];
  if (!paths.every((p) => isHomeworkFilePath(p, ctx.familyId, current.child_id))) return jsonError("Tệp không hợp lệ.", 400);
  const before = new Set<string>(current.photo_paths ?? []);
  const added = paths.filter((p) => !before.has(p));
  const missing = added.length > 0 ? await missingHomeworkFiles(ctx.db, added) : null;
  if (missing) return jsonError(missing, 400);
  const used = await pathsUsedElsewhere(ctx.db, added, id.data);
  if (used === null) return jsonError("Không kiểm tra được tệp, thử lại.", 500);
  if (used.size > 0) return jsonError("Tệp này đang thuộc bài khác.", 400);

  const { data, error } = await ctx.db
    .from("homework_items")
    .update({ subject: body.subject, due_date: body.dueDate, note: body.note, photo_paths: paths })
    .eq("id", id.data)
    .select("id");
  if (error) {
    console.error("homework.edit failed", error.message);
    return jsonError("Không lưu được.", 500);
  }
  if (!data || data.length === 0) return jsonError("Không tìm thấy bài.", 404);

  const removed = [...before].filter((p) => !paths.includes(p));
  await removeHomeworkFiles(ctx.db, removed, id.data);
  await writeAudit(ctx, "homework.edit", {
    id: id.data,
    subject: body.subject,
    due_date: body.dueDate,
    previous_due_date: current.due_date,
    files_added: added.length,
    files_removed: removed.length,
  });
  return NextResponse.json({ ok: true });
}
