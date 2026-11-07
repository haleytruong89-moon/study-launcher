import { NextResponse } from "next/server";
import { requireChild } from "@/lib/today/service";
import { weekDays } from "@/lib/today/weekDaysServer";

/**
 * GET: the child's own week (R2 "Tuần của con" + the feelings chart on Hôm nay). Child session
 * only: a parent gets 403 — parents have no page or route that shows the child's feelings
 * (parent decision 07/11/2026). Never cached.
 */
export async function GET() {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  try {
    return NextResponse.json(await weekDays(guard.ctx), { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("week.days failed");
    return NextResponse.json({ error: "Chưa tải được tuần này, thử lại sau." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
