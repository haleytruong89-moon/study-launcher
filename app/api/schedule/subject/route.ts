import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, requireChild, serverError } from "@/lib/today/service";

const bodySchema = z.object({
  key: z.string().trim().min(1).max(40),
  label: z.string().trim().max(30).default(""),
  color: z
    .string()
    .regex(/^(#[0-9A-Fa-f]{6})?$/)
    .default(""),
  bring: z.string().trim().max(120).default(""),
});

/**
 * POST (child, 21/11/2026): colour / name / bring list of one subject. Low stakes: no Nhật ký
 * entry, no restore. Server write (the child has SELECT only).
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Thông tin môn chưa đúng.", 400);
  try {
    const { error } = await createAdminClient()
      .from("subject_prefs")
      .upsert(
        {
          child_id: ctx.childId,
          family_id: ctx.familyId,
          subject_key: parsed.data.key,
          label: parsed.data.label,
          color: parsed.data.color,
          bring: parsed.data.bring,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "child_id,subject_key" },
      );
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError("schedule.subject", e);
  }
}
