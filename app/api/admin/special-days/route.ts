import { NextResponse } from "next/server";
import { z } from "zod";
import { firstIssue, isFamilyChild, jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";
import { DAY_TYPES, decideSpecialDay, type TemplateForDay } from "@/lib/admin/specialDay";

const bodySchema = z.object({
  childId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ."),
  dayType: z.enum(DAY_TYPES),
  disabledTemplateIds: z.array(z.uuid()).max(50).default([]),
});

/**
 * "Ngày đặc biệt" (S3d): the parent sets day_sessions.day_type (+ disabled_template_ids on exam /
 * holiday days) for one child, today or a later day (server clock). Setting "normal" is how it is
 * cleared; the row is never deleted (it holds the day's milestones). Only the parent's own
 * session writes (RLS parent_all); the lock/open effect comes from computeDayState unchanged.
 */
export async function POST(request: Request) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
  const b = parsed.data;
  if (!(await isFamilyChild(ctx.db, b.childId))) return jsonError("Không tìm thấy tài khoản con.", 400);

  const [templates, previous] = await Promise.all([
    ctx.db.from("task_templates").select("id, part, title, weekdays, sort, active").eq("child_id", b.childId),
    ctx.db.from("day_sessions").select("day_type, disabled_template_ids").eq("child_id", b.childId).eq("local_date", b.date).maybeSingle(),
  ]);
  if (templates.error || previous.error) {
    console.error("special-day read failed", templates.error?.message ?? previous.error?.message);
    return jsonError("Không đọc được lịch của con, thử lại.", 500);
  }

  const decided = decideSpecialDay(b, new Date(), (templates.data ?? []) as TemplateForDay[]);
  if (!decided.ok) return jsonError(decided.error, 400);
  const row = decided.row;

  const before = previous.data as { day_type: string; disabled_template_ids: string[] | null } | null;
  // Nothing stored and nothing to store: do not create an empty row for a later day.
  if (before !== null || row.day_type !== "normal") {
    const { error } = await ctx.db
      .from("day_sessions")
      .upsert({ child_id: b.childId, family_id: ctx.familyId, local_date: b.date, ...row }, { onConflict: "child_id,local_date" });
    if (error) {
      console.error("special-day upsert failed", error.message);
      return jsonError("Không lưu được.", 500);
    }
  }

  await writeAudit(ctx, "day_type.set", {
    child_id: b.childId,
    date: b.date,
    day_type: row.day_type,
    disabled_template_ids: row.disabled_template_ids,
    previous: before ? { day_type: before.day_type, disabled_template_ids: before.disabled_template_ids ?? [] } : null,
  });
  return NextResponse.json({ ok: true, date: b.date, dayType: row.day_type, disabledTemplateIds: row.disabled_template_ids });
}
