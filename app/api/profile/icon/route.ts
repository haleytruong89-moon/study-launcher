import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, requireChild, serverError, todayView } from "@/lib/today/service";
import { isIcon } from "@/lib/today/week";

const bodySchema = z.object({ icon: z.string().max(16) });

/** Child picks their icon from the fixed set (parent decision 17/10/2026; colour stays the parent's). */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isIcon(parsed.data.icon)) return jsonError("Biểu tượng không có trong danh sách.", 400);

  try {
    const { error } = await createAdminClient().from("profiles").update({ icon: parsed.data.icon }).eq("id", ctx.childId).eq("role", "child");
    if (error) throw new Error(error.message);
    return NextResponse.json(await todayView(ctx));
  } catch (e) {
    return serverError("profile.icon", e);
  }
}
