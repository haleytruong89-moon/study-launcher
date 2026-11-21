import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDate } from "@/lib/time";
import { loadTimetables } from "@/lib/timetable/load";
import { validateData, versionOn } from "@/lib/timetable/rules";
import { scheduleAudit } from "@/lib/schedule/audit";
import { childValidFromOk, diffPeriods } from "@/lib/schedule/rules";
import { timetableSnapshot } from "@/lib/schedule/snapshot";
import { jsonError, requireChild, serverError } from "@/lib/today/service";

const bodySchema = z.object({ validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), data: z.unknown() });

/**
 * POST (child): save the timetable (parent decision 21/11/2026: "con tự sửa, áp dụng ngay").
 * The server checks the shape and the date, writes with service_role (the child still has no
 * write grant), and logs the BEFORE so the parents can restore it.
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || Number.isNaN(Date.parse(`${parsed.data.validFrom}T00:00:00Z`))) return jsonError("Ngày áp dụng chưa đúng.", 400);
  const v = validateData(parsed.data.data);
  if (!v.ok) return jsonError(v.error, 400);
  try {
    const today = localDate(new Date());
    const versions = await loadTimetables(ctx.db, [ctx.childId]);
    const current = versionOn(versions, today);
    const bad = childValidFromOk(parsed.data.validFrom, current?.validFrom ?? null, today);
    if (bad) return jsonError(bad, 400);
    const same = versions.find((x) => x.validFrom === parsed.data.validFrom) ?? null;
    const before = same ?? versionOn(versions, parsed.data.validFrom);
    const row = {
      family_id: ctx.familyId,
      child_id: ctx.childId,
      valid_from: parsed.data.validFrom,
      label: v.data.label,
      note: v.data.note,
      periods: v.data.periods,
      times: v.data.times,
      uniform: v.data.uniform,
      updated_by: ctx.childId,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await createAdminClient().from("timetables").upsert(row, { onConflict: "child_id,valid_from" }).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "no row");
    const changes = diffPeriods(before?.periods ?? [], v.data.periods);
    await scheduleAudit(ctx.familyId, ctx.childId, "schedule.timetable", {
      child_id: ctx.childId,
      id: data.id,
      valid_from: parsed.data.validFrom,
      changes: changes.slice(0, 12),
      change_count: changes.length,
      uniform_changed: JSON.stringify(before?.uniform ?? {}) !== JSON.stringify(v.data.uniform),
      // null = this version is new: Khôi phục removes it again (the older one applies as before).
      before: same ? timetableSnapshot(same) : null,
    });
    return NextResponse.json({ ok: true, id: data.id, changes });
  } catch (e) {
    return serverError("schedule.timetable", e);
  }
}
