import { NextResponse } from "next/server";
import { homeworkSchema, isHomeworkPhotoPath } from "@/lib/admin/schemas";
import { firstIssue, isFamilyChild, jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";
import { addDays } from "@/lib/admin/dates";
import { localDate } from "@/lib/time";

/** How far ahead a due date may be set (sanity guard against typos). */
const MAX_DAYS_AHEAD = 60;

/**
 * Parent assigns school homework: one subject + one due date, with photos already uploaded
 * by the browser to homework/{family_id}/{child_id}/{due_date}/ (DESIGN section 9).
 */
export async function POST(request: Request) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = homeworkSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
  const h = parsed.data;

  // Server clock, Asia/Ho_Chi_Minh (CLAUDE.md: never trust the client clock).
  const today = localDate(new Date());
  if (h.dueDate < today || h.dueDate > addDays(today, MAX_DAYS_AHEAD)) {
    return jsonError("Ngày phải nộp phải từ hôm nay trở đi.", 400);
  }
  if (!(await isFamilyChild(ctx.db, h.childId))) return jsonError("Không tìm thấy tài khoản con.", 400);

  const paths = [...new Set(h.photoPaths)];
  if (!paths.every((p) => isHomeworkPhotoPath(p, ctx.familyId, h.childId, h.dueDate))) {
    return jsonError("Ảnh không hợp lệ.", 400);
  }
  if (paths.length > 0) {
    // Every referenced photo must really exist in that folder (listing is RLS-checked too).
    const folder = `${ctx.familyId}/${h.childId}/${h.dueDate}`;
    const { data: objects, error: listError } = await ctx.db.storage.from("homework").list(folder, { limit: 1000 });
    if (listError) {
      console.error("homework.create: list photos failed", listError.message);
      return jsonError("Không kiểm tra được ảnh, thử lại.", 500);
    }
    const names = new Set((objects ?? []).map((o) => `${folder}/${o.name}`));
    if (!paths.every((p) => names.has(p))) return jsonError("Ảnh chưa tải lên xong, thử lại.", 400);
  }

  const row = {
    family_id: ctx.familyId,
    child_id: h.childId,
    subject: h.subject,
    due_date: h.dueDate,
    note: h.note,
    photo_paths: paths,
    created_by: ctx.userId,
  };
  const { data, error } = await ctx.db.from("homework_items").insert(row).select("id").single();
  if (error || !data) {
    console.error("homework.create failed", error?.message);
    return jsonError("Không giao được bài.", 500);
  }
  await writeAudit(ctx, "homework.create", { id: data.id, child_id: h.childId, subject: h.subject, due_date: h.dueDate, photos: paths.length });
  return NextResponse.json({ ok: true, id: data.id });
}
