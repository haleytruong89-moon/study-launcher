import { NextResponse } from "next/server";
import { escalateSoon } from "@/lib/binhYen/talk";
import { ServerTimer } from "@/lib/serverTiming";
import { requireChild, serverError, todayView } from "@/lib/today/service";

export const dynamic = "force-dynamic";

/** The child's "Hôm nay": day state (server clock) + homework photos. Polled every 30 s. */
export async function GET() {
  const timer = new ServerTimer();
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  timer.mark("auth");
  // Góc bình yên: re-push an unseen "Con muốn nói chuyện" after the answer is sent (never blocks it).
  escalateSoon(guard.ctx.familyId);
  try {
    const view = await todayView(guard.ctx);
    timer.mark("db");
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store", "Server-Timing": timer.header() } });
  } catch (e) {
    timer.mark("db");
    const res = serverError("today", e);
    res.headers.set("Server-Timing", timer.header());
    return res;
  }
}
