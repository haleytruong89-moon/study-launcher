import { NextResponse } from "next/server";
import { requireParent } from "@/lib/admin/guard";

/** Number of pending "Xin mở trang" (the red badge on the parent menu, polled every 30 s). */
export async function GET() {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { count } = await guard.ctx.db.from("unlock_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
  return NextResponse.json({ pending: count ?? 0 }, { headers: { "Cache-Control": "no-store" } });
}
