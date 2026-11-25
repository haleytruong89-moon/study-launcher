import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isFamilyChild, jsonError, requireParent, writeAudit } from "@/lib/admin/guard";
import {
  STUDY_APP_MAX_BYTES,
  STUDY_APP_TITLE_MAX,
  isStudyAppPathOf,
  isValidStudyAppSlug,
  looksLikeHtmlPage,
  slugifyStudyApp,
  studyAppPath,
} from "@/lib/studyApps";

const childIdSchema = z.union([z.uuid(), z.literal("")]);

/**
 * Parent adds a review app (one .html file) or REPLACES the file of an app with the same address.
 * Multipart form: title, slug (optional: made from the title), childId ("" = whole family), file.
 * Everything is written with the parent's OWN session (RLS: parent_all on study_apps and on the
 * family folder of the `study-apps` bucket). A replace keeps the app on/off as it was.
 */
export async function POST(request: Request) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("Không đọc được dữ liệu gửi lên.", 400);

  const title = String(form.get("title") ?? "").trim();
  if (!title) return jsonError("Đặt tên cho app.", 400);
  if (title.length > STUDY_APP_TITLE_MAX) return jsonError(`Tên app tối đa ${STUDY_APP_TITLE_MAX} ký tự.`, 400);

  const slugInput = String(form.get("slug") ?? "").trim().toLowerCase();
  const slug = slugInput || slugifyStudyApp(title);
  if (!isValidStudyAppSlug(slug)) {
    return jsonError("Địa chỉ app chỉ gồm chữ thường không dấu, số và dấu gạch (2–48 ký tự).", 400);
  }

  const childParsed = childIdSchema.safeParse(String(form.get("childId") ?? ""));
  if (!childParsed.success) return jsonError("Không tìm thấy tài khoản con.", 400);
  const childId = childParsed.data || null;
  if (childId && !(await isFamilyChild(ctx.db, childId))) return jsonError("Không tìm thấy tài khoản con.", 400);

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return jsonError("Chọn tệp .html của app.", 400);
  if (file.size > STUDY_APP_MAX_BYTES) return jsonError("Tệp lớn quá (tối đa 4 MB).", 400);
  const text = await file.text();
  if (!looksLikeHtmlPage(text)) return jsonError("Tệp này không phải trang .html của app ôn tập.", 400);

  const { data: existing } = await ctx.db
    .from("study_apps")
    .select("id, file_path")
    .eq("family_id", ctx.familyId)
    .eq("slug", slug)
    .maybeSingle();

  const path = studyAppPath(ctx.familyId, slug, randomBytes(8).toString("hex"));
  const up = await ctx.db.storage
    .from("study-apps")
    .upload(path, new Blob([text], { type: "text/html" }), { contentType: "text/html", upsert: false });
  if (up.error) {
    console.error("study_app.upload failed", up.error.message);
    return jsonError("Không tải được tệp lên.", 500);
  }

  const row = { title, child_id: childId, file_path: path, updated_at: new Date().toISOString() };
  const saved = existing
    ? await ctx.db.from("study_apps").update(row).eq("id", existing.id).select("id").single()
    : await ctx.db.from("study_apps").insert({ ...row, family_id: ctx.familyId, slug }).select("id").single();
  if (saved.error || !saved.data) {
    console.error("study_app.save failed", saved.error?.message);
    await ctx.db.storage.from("study-apps").remove([path]);
    return jsonError("Không lưu được app.", 500);
  }

  // The old file of a replaced app is no longer used.
  if (existing && existing.file_path !== path && isStudyAppPathOf(existing.file_path, ctx.familyId)) {
    const rm = await ctx.db.storage.from("study-apps").remove([existing.file_path]);
    if (rm.error) console.error("study_app.remove_old failed", rm.error.message);
  }

  await writeAudit(ctx, existing ? "study_app.replace" : "study_app.create", {
    id: saved.data.id,
    slug,
    title,
    child_id: childId,
    bytes: file.size,
  });
  return NextResponse.json({ ok: true, id: saved.data.id, slug, replaced: !!existing });
}
