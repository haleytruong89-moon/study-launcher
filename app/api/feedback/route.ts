import { NextResponse } from "next/server";
import {
  FEEDBACK_LIMIT_TEXT,
  FEEDBACK_NOT_READY,
  feedbackBodySchema,
  feedbackLimitReached,
  tableMissing,
} from "@/lib/feedback/rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDate, startOfLocalDay } from "@/lib/time";
import { requireChild } from "@/lib/today/service";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * "Góp ý": a child sends feedback about the app (parent decision 07/11/2026). Child session
 * only; the family and the child come from the session, never from the body. At most 10 per
 * child per Vietnam day (counted on the server). Not private: parents read it in the app
 * (Thêm › Góp ý của con). No push, no audit_log; nothing of the text is logged.
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = feedbackBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues.find((i) => i.path[0] === "body");
    return json({ error: issue?.message && issue.code !== "invalid_type" ? issue.message : "Yêu cầu không hợp lệ." }, 400);
  }

  const admin = createAdminClient();
  const now = new Date();
  const since = startOfLocalDay(localDate(now)).toISOString();
  const { count, error: countErr } = await admin.from("app_feedback").select("id", { count: "exact", head: true }).eq("child_id", ctx.childId).gte("created_at", since);
  if (tableMissing(countErr)) return json({ error: FEEDBACK_NOT_READY }, 503);
  if (countErr) {
    console.error("feedback.count failed");
    return json({ error: "Chưa gửi được, thử lại sau ít phút." }, 500);
  }
  if (feedbackLimitReached(count ?? 0)) return json({ error: FEEDBACK_LIMIT_TEXT }, 429);

  const { data, error } = await admin
    .from("app_feedback")
    .insert({ family_id: ctx.familyId, child_id: ctx.childId, kind: parsed.data.kind, body: parsed.data.body })
    .select("id, created_at")
    .single();
  if (tableMissing(error)) return json({ error: FEEDBACK_NOT_READY }, 503);
  if (error || !data) {
    console.error("feedback.insert failed");
    return json({ error: "Chưa gửi được, thử lại sau ít phút." }, 500);
  }
  return json({ ok: true, id: data.id, createdAt: data.created_at });
}
