import { NextResponse } from "next/server";
import { z } from "zod";
import { firstIssue, jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";
import { parseQuick } from "@/lib/timetable/rules";

const saveSchema = z.object({
  childId: z.string().uuid(),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày áp dụng chưa đúng."),
  text: z.string().max(5000, "Thời khóa biểu dài quá."),
});

/**
 * Thời khóa biểu (18/11/2026): the parent saves one version (the quick text) for a child, from a
 * day on. Same child + same day = that version is replaced. Parent session only; RLS keeps it to
 * the family (the child must be theirs).
 */
export async function POST(request: Request) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = saveSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
  if (Number.isNaN(Date.parse(`${parsed.data.validFrom}T00:00:00Z`))) return jsonError("Ngày áp dụng chưa đúng.", 400);
  const tt = parseQuick(parsed.data.text);
  if (!tt.ok) return NextResponse.json({ error: tt.errors[0], errors: tt.errors }, { status: 400 });

  const { data: kid } = await ctx.db.from("profiles").select("id").eq("id", parsed.data.childId).eq("role", "child").eq("family_id", ctx.familyId).maybeSingle();
  if (!kid) return jsonError("Không tìm thấy con.", 404);

  const row = {
    family_id: ctx.familyId,
    child_id: parsed.data.childId,
    valid_from: parsed.data.validFrom,
    label: tt.data.label,
    note: tt.data.note,
    periods: tt.data.periods,
    times: tt.data.times,
    uniform: tt.data.uniform,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await ctx.db.from("timetables").upsert(row, { onConflict: "child_id,valid_from" }).select("id").single();
  if (error || !data) {
    console.error("timetable.save failed", error?.message);
    return jsonError("Không lưu được thời khóa biểu.", 500);
  }
  await writeAudit(ctx, "timetable.save", { id: data.id, child_id: row.child_id, valid_from: row.valid_from, label: row.label, periods: row.periods.length });
  return NextResponse.json({ ok: true, id: data.id });
}

/** Deletes one version (?id=…). */
export async function DELETE(request: Request) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!z.string().uuid().safeParse(id).success) return jsonError("Thiếu bản thời khóa biểu.", 400);
  const { data, error } = await ctx.db.from("timetables").delete().eq("id", id).eq("family_id", ctx.familyId).select("id, child_id, valid_from");
  if (error) {
    console.error("timetable.delete failed", error.message);
    return jsonError("Không xóa được.", 500);
  }
  if (!data || data.length === 0) return jsonError("Không tìm thấy bản này.", 404);
  await writeAudit(ctx, "timetable.delete", { id, child_id: data[0]!.child_id, valid_from: data[0]!.valid_from });
  return NextResponse.json({ ok: true });
}
