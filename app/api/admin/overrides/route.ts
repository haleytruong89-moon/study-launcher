import { NextResponse } from "next/server";
import { z } from "zod";
import { firstIssue, isFamilyChild, jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";
import { overrideRow } from "@/lib/admin/override";
import { computeDayState } from "@/lib/dayState";
import { localDate } from "@/lib/time";
import { loadDay } from "@/lib/today/load";

const bodySchema = z.object({
  childId: z.uuid(),
  action: z.enum(["open", "lock", "extend", "clear"]),
  minutes: z.number().int().min(1).max(1440).nullable(),
  reason: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
});

/**
 * Parent opens / locks / extends / clears a child's laptop from their own phone (S3c).
 * Server clock, `until` clipped at 00:00, the newest override of today wins (DESIGN 5).
 * Written with the parent's session (RLS parent_all) and logged in audit_log.
 */
export async function POST(request: Request) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
  const b = parsed.data;
  if (!(await isFamilyChild(ctx.db, b.childId))) return jsonError("Không tìm thấy tài khoản con.", 400);

  const now = new Date();
  const today = localDate(now);
  let current: { openUntil: string | null; overrideActive: boolean };
  try {
    const { input } = await loadDay(ctx.db, b.childId, ctx.familyId, today);
    const s = computeDayState(input, now);
    current = { openUntil: s.openUntil, overrideActive: s.status === "OPEN_OVERRIDE" || s.status === "LOCK_OVERRIDE" };
  } catch (e) {
    console.error("override: read state failed", e instanceof Error ? e.message : e);
    return jsonError("Không đọc được trạng thái của con, thử lại.", 500);
  }

  const decided = overrideRow(b.action, b.minutes, now, current);
  if (!decided.ok) return jsonError(decided.error, 409);

  const row = {
    family_id: ctx.familyId,
    child_id: b.childId,
    local_date: today,
    kind: decided.row.kind,
    until: decided.row.until,
    created_by: ctx.userId,
    reason: b.reason,
    created_at: now.toISOString(),
  };
  const { error } = await ctx.db.from("overrides").insert(row);
  if (error) {
    console.error("override insert failed", error.message);
    return jsonError("Không lưu được.", 500);
  }
  await writeAudit(ctx, `override.${b.action}`, { child_id: b.childId, kind: row.kind, until: row.until, minutes: b.minutes, reason: b.reason });
  return NextResponse.json({ ok: true, kind: row.kind, until: row.until });
}
