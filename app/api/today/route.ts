import { NextResponse } from "next/server";
import { requireChild, serverError, todayView } from "@/lib/today/service";

export const dynamic = "force-dynamic";

/** The child's "Hôm nay": day state (server clock) + homework photos. Polled every 30 s. */
export async function GET() {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  try {
    return NextResponse.json(await todayView(guard.ctx), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return serverError("today", e);
  }
}
