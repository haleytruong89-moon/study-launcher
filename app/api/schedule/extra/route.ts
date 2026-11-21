import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDate } from "@/lib/time";
import { versionOn } from "@/lib/timetable/rules";
import { scheduleAudit } from "@/lib/schedule/audit";
import { loadSchedule } from "@/lib/schedule/load";
import { cleanSessions, conflicts, extraBusy, schoolBusy, sessionsText } from "@/lib/schedule/rules";
import { extraSnapshot } from "@/lib/schedule/snapshot";
import { jsonError, requireChild, serverError } from "@/lib/today/service";

const bodySchema = z.object({
  id: z.string().uuid().optional(),
  subject: z.string().trim().min(1, "Chọn môn.").max(30, "Tên môn dài quá."),
  sessions: z.unknown(),
  place: z.enum(["home", "center", "online"]),
  bring: z.string().max(120, "Phần cần mang dài quá.").default(""),
  note: z.string().max(120, "Ghi chú dài quá.").default(""),
  appSlotId: z.string().uuid().nullable().default(null),
});

const VI = /[À-ỹ]/;

/**
 * POST (child, 21/11/2026): save one extra class (new or edited). Clashes with school or another
 * class are REPORTED, not blocked: the child checks the time. Server write + audit with BEFORE.
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message;
    return jsonError(msg && VI.test(msg) ? msg : "Thiếu hoặc sai thông tin.", 400);
  }
  const sessions = cleanSessions(parsed.data.sessions);
  if (typeof sessions === "string") return jsonError(sessions, 400);
  try {
    const { versions, extras } = await loadSchedule(ctx.db, [ctx.childId]);
    const old = parsed.data.id ? (extras.find((e) => e.id === parsed.data.id) ?? null) : null;
    if (parsed.data.id && !old) return jsonError("Không tìm thấy buổi học thêm này.", 404);
    if (parsed.data.appSlotId) {
      // RLS: the child only sees app slots meant for them.
      const { data: s } = await ctx.db.from("app_slots").select("id").eq("id", parsed.data.appSlotId).maybeSingle();
      if (!s) return jsonError("App này không có trong danh sách của con.", 400);
    }
    const fields = {
      subject: parsed.data.subject,
      sessions,
      place: parsed.data.place,
      bring: parsed.data.bring.trim(),
      note: parsed.data.note.trim(),
      app_slot_id: parsed.data.appSlotId,
      active: true,
      updated_by: ctx.childId,
      updated_at: new Date().toISOString(),
    };
    const admin = createAdminClient();
    const { data, error } = old
      ? await admin.from("extra_classes").update(fields).eq("id", old.id).eq("child_id", ctx.childId).select("id").single()
      : await admin
          .from("extra_classes")
          .insert({ ...fields, family_id: ctx.familyId, child_id: ctx.childId })
          .select("id")
          .single();
    if (error || !data) throw new Error(error?.message ?? "no row");
    const clash = conflicts(sessions, [...schoolBusy(versionOn(versions, localDate(new Date()))), ...extraBusy(extras, old?.id)]);
    await scheduleAudit(ctx.familyId, ctx.childId, "schedule.extra.save", {
      child_id: ctx.childId,
      id: data.id,
      summary: `${parsed.data.subject}: ${sessionsText(sessions)}`,
      conflicts: clash.length,
      before: old ? extraSnapshot(old) : null,
    });
    return NextResponse.json({ ok: true, id: data.id, conflicts: clash });
  } catch (e) {
    return serverError("schedule.extra", e);
  }
}

/** DELETE ?id=… (child): turn one extra class off. Kept in the table so Khôi phục can bring it back. */
export async function DELETE(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!z.string().uuid().safeParse(id).success) return jsonError("Thiếu buổi học thêm.", 400);
  try {
    const { extras } = await loadSchedule(ctx.db, [ctx.childId]);
    const old = extras.find((e) => e.id === id);
    if (!old) return jsonError("Không tìm thấy buổi học thêm này.", 404);
    const { error } = await createAdminClient()
      .from("extra_classes")
      .update({ active: false, updated_by: ctx.childId, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("child_id", ctx.childId);
    if (error) throw new Error(error.message);
    await scheduleAudit(ctx.familyId, ctx.childId, "schedule.extra.off", {
      child_id: ctx.childId,
      id,
      summary: `${old.subject}: ${sessionsText(old.sessions)}`,
      before: extraSnapshot(old),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError("schedule.extra.off", e);
  }
}
