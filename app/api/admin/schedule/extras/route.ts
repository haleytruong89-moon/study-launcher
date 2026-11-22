import { NextResponse } from "next/server";
import { z } from "zod";
import { firstIssue, isFamilyChild, jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";
import { loadExtras, loadSlotChoices } from "@/lib/schedule/load";
import { parseQuickExtras, planQuickExtras, type QuickExtra } from "@/lib/schedule/quickExtras";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  childId: z.string().uuid(),
  text: z.string().max(5000, "Danh sách dài quá."),
});

const fields = (c: QuickExtra, by: string) => ({
  subject: c.subject,
  sessions: c.sessions,
  place: c.place,
  bring: c.bring,
  note: c.note,
  app_slot_id: c.appSlotId,
  active: true,
  updated_by: by,
  updated_at: new Date().toISOString(),
});

/**
 * POST (parent, 22/11/2026): "Dán học thêm" — the parent pastes a child's whole list of extra
 * classes (one line per subject). Classes still listed are updated (matched by subject), new ones
 * added, the ones left out turned off (kept in the table, like the child's "Bỏ"). The child keeps
 * editing them in Sửa lịch học. Parent session checks the child; the write is the server's (the
 * table has no browser write grant). Display only: it never changes what is locked.
 */
export async function POST(request: Request) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
  const { childId, text } = parsed.data;
  if (!(await isFamilyChild(ctx.db, childId))) return jsonError("Không tìm thấy con.", 404);

  const slots = (await loadSlotChoices(ctx.db, [childId])).get(childId) ?? [];
  const list = parseQuickExtras(text, slots);
  if (!list.ok) return NextResponse.json({ error: list.errors[0], errors: list.errors }, { status: 400 });

  const existing = await loadExtras(ctx.db, [childId]);
  const plan = planQuickExtras(existing, list.classes);
  const admin = createAdminClient();
  try {
    for (const u of plan.update) {
      const { error } = await admin.from("extra_classes").update(fields(u.data, ctx.userId)).eq("id", u.id).eq("family_id", ctx.familyId).eq("child_id", childId);
      if (error) throw new Error(error.message);
    }
    if (plan.insert.length > 0) {
      const { error } = await admin
        .from("extra_classes")
        .insert(plan.insert.map((c) => ({ ...fields(c, ctx.userId), family_id: ctx.familyId, child_id: childId })));
      if (error) throw new Error(error.message);
    }
    if (plan.off.length > 0) {
      const { error } = await admin
        .from("extra_classes")
        .update({ active: false, updated_by: ctx.userId, updated_at: new Date().toISOString() })
        .in("id", plan.off)
        .eq("family_id", ctx.familyId)
        .eq("child_id", childId);
      if (error) throw new Error(error.message);
    }
  } catch (e) {
    console.error("schedule.extras.paste failed", e instanceof Error ? e.message : e);
    return jsonError("Không lưu được học thêm.", 500);
  }
  const counts = { added: plan.insert.length, updated: plan.update.length, off: plan.off.length };
  await writeAudit(ctx, "schedule.extras.paste", { child_id: childId, ...counts, subjects: list.classes.map((c) => c.subject) });
  return NextResponse.json({ ok: true, ...counts });
}
