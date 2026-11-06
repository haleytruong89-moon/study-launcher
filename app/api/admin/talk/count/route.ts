import { NextResponse } from "next/server";
import { requireParent } from "@/lib/admin/guard";
import { unseenTalkCount } from "@/lib/binhYen/parent";

export const dynamic = "force-dynamic";

/** Unseen "Con muốn nói chuyện" (the banner on every parent page, polled every 20 s). */
export async function GET() {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  return NextResponse.json({ unseen: await unseenTalkCount(guard.ctx.db) }, { headers: { "Cache-Control": "no-store" } });
}
