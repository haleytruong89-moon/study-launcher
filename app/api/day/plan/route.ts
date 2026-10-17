import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, readToday, requireChild, serverError, todayView } from "@/lib/today/service";
import { cleanPlan, MAX_PLAN_ITEMS } from "@/lib/today/week";

const bodySchema = z.object({ keys: z.array(z.string().max(80)).max(MAX_PLAN_ITEMS * 2) });

/**
 * Child saves (or clears, with an empty list) "Kế hoạch hôm nay": the order they want to do
 * today's tasks in. Display only: it never changes what locks or opens the laptop.
 * Keys that are not today's tasks are dropped on the server.
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Kế hoạch không hợp lệ.", 400);

  try {
    const { state } = await readToday(ctx);
    const admin = createAdminClient();
    const keys = parsed.data.keys.length === 0 ? null : cleanPlan(state, parsed.data.keys);
    if (parsed.data.keys.length > 0 && !keys) return jsonError("Chọn ít nhất 1 việc của hôm nay.", 400);
    const { error } = keys
      ? await admin
          .from("day_plans")
          .upsert(
            { child_id: ctx.childId, family_id: ctx.familyId, local_date: state.localDate, item_keys: keys, updated_at: new Date().toISOString() },
            { onConflict: "child_id,local_date" },
          )
      : await admin.from("day_plans").update({ item_keys: [], updated_at: new Date().toISOString() }).eq("child_id", ctx.childId).eq("local_date", state.localDate);
    if (error) throw new Error(error.message);
    return NextResponse.json(await todayView(ctx));
  } catch (e) {
    return serverError("day.plan", e);
  }
}
