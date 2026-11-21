import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";
import { restorePlan } from "@/lib/schedule/restore";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({ auditId: z.string().uuid() });

/**
 * POST (parent, 21/11/2026): put back the BEFORE of one schedule change the child made. The entry
 * is read with the parent's own session (RLS: only this family's Nhật ký); the write is scoped to
 * the family and done by the server (the schedule tables have no browser write grant).
 */
export async function POST(request: Request) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("Thiếu mục cần khôi phục.", 400);
  const { data: entry } = await ctx.db.from("audit_log").select("id, action, payload").eq("id", parsed.data.auditId).eq("family_id", ctx.familyId).maybeSingle();
  if (!entry) return jsonError("Không tìm thấy mục này.", 404);
  const step = restorePlan(entry);
  if ("error" in step) return jsonError(step.error, 400);
  const admin = createAdminClient();
  const res =
    step.op === "delete"
      ? await admin.from(step.table).delete().eq("id", step.id).eq("family_id", ctx.familyId).select("id")
      : await admin
          .from(step.table)
          .update({ ...step.values, updated_by: ctx.userId, updated_at: new Date().toISOString() })
          .eq("id", step.id)
          .eq("family_id", ctx.familyId)
          .select("id");
  if (res.error) {
    console.error("schedule.restore failed", res.error.message);
    return jsonError("Không khôi phục được.", 500);
  }
  if (!res.data || res.data.length === 0) return jsonError("Bản này không còn nữa.", 404);
  const payload = (entry.payload ?? {}) as Record<string, unknown>;
  await writeAudit(ctx, "schedule.restore", { child_id: payload.child_id ?? null, of: entry.id, target: step.table });
  return NextResponse.json({ ok: true });
}
