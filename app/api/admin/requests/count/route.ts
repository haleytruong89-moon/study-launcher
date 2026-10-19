import { NextResponse } from "next/server";
import { requireParent } from "@/lib/admin/guard";
import { pendingForParent } from "@/lib/admin/pending";

/** Number of pending child requests (the red badge on the parent menu, polled every 30 s). */
export async function GET() {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  return NextResponse.json({ pending: await pendingForParent(guard.ctx.db) }, { headers: { "Cache-Control": "no-store" } });
}
