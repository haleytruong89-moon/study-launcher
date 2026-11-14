import { NextResponse } from "next/server";
import { clampRange } from "@/lib/today/calendar";
import { readCalendar } from "@/lib/today/calendarServer";
import { ServerTimer } from "@/lib/serverTiming";
import { requireChild, serverError } from "@/lib/today/service";
import { localDate } from "@/lib/time";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET ?from=YYYY-MM-DD&to=YYYY-MM-DD: "Lịch của con" (read only). Child session only (401 / 403
 * otherwise). The range is clamped on the SERVER clock to today − 31 … today + 93 and at most 62
 * dates; a malformed date answers 400. Display only: nothing here changes a task or the lock.
 */
export async function GET(request: Request) {
  const timer = new ServerTimer();
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  timer.mark("auth");
  const now = new Date();
  const params = new URL(request.url).searchParams;
  const range = clampRange(params.get("from"), params.get("to"), localDate(now));
  if (!range) return NextResponse.json({ error: "Khoảng ngày không hợp lệ." }, { status: 400, headers: { ...NO_STORE, "Server-Timing": timer.header() } });
  try {
    const view = await readCalendar(guard.ctx, range, now);
    timer.mark("db");
    return NextResponse.json(view, { headers: { ...NO_STORE, "Server-Timing": timer.header() } });
  } catch (e) {
    timer.mark("db");
    const res = serverError("calendar", e);
    res.headers.set("Server-Timing", timer.header());
    return res;
  }
}
