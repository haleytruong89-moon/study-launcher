import { NextResponse } from "next/server";
import { isMonday } from "@/lib/comic/volume";
import { requireChild } from "@/lib/today/service";
import { weekDays } from "@/lib/today/weekDaysServer";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET: the child's own week (R2 "Tuần của con" + the feelings chart on Hôm nay). Child session
 * only: a parent gets 403 — parents have no page or route that shows the child's feelings
 * (parent decision 07/11/2026). Never cached.
 *
 * R5: `?week=YYYY-MM-DD` (a Monday) reads a past week for Nguyên's comic shelf: 400 when it is
 * not a Monday, 404 outside the first record's week … this week.
 */
export async function GET(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const wanted = new URL(request.url).searchParams.get("week");
  if (wanted !== null && !isMonday(wanted)) return NextResponse.json({ error: "Tuần không hợp lệ." }, { status: 400, headers: NO_STORE });
  try {
    const view = await weekDays(guard.ctx, new Date(), wanted);
    if (!view) return NextResponse.json({ error: "Không có tuần này." }, { status: 404, headers: NO_STORE });
    return NextResponse.json(view, { headers: NO_STORE });
  } catch {
    console.error("week.days failed");
    return NextResponse.json({ error: "Chưa tải được tuần này, thử lại sau." }, { status: 500, headers: NO_STORE });
  }
}
