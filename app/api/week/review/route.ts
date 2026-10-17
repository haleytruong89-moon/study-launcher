import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, requireChild, serverError, todayView } from "@/lib/today/service";
import { reviewWeek } from "@/lib/today/week";

const answer = z
  .string({ error: "Thiếu câu trả lời." })
  .trim()
  .max(500, "Mỗi câu tối đa 500 chữ.")
  .transform((v) => (v === "" ? null : v));
const bodySchema = z.object({ wentWell: answer, changeNext: answer });

/**
 * Child saves "Tổng kết tuần" (2 short answers; parents can read them). Only while the
 * review is open on the SERVER clock: Sunday from 17:00 until the end of Monday.
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Thiếu câu trả lời.", 400);
  if (!parsed.data.wentWell && !parsed.data.changeNext) return jsonError("Viết ít nhất 1 câu nhé.", 400);

  const now = new Date();
  const week = reviewWeek(now);
  if (!week) return jsonError("Tổng kết tuần mở từ 17:00 Chủ nhật đến hết Thứ Hai.", 409);

  try {
    const { error } = await createAdminClient()
      .from("weekly_reviews")
      .upsert(
        {
          child_id: ctx.childId,
          family_id: ctx.familyId,
          week_start: week,
          went_well: parsed.data.wentWell,
          change_next: parsed.data.changeNext,
          updated_at: now.toISOString(),
        },
        { onConflict: "child_id,week_start" },
      );
    if (error) throw new Error(error.message);
    return NextResponse.json(await todayView(ctx, now));
  } catch (e) {
    return serverError("week.review", e);
  }
}
