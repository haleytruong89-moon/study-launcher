import { NextResponse } from "next/server";
import { jsonError, requireParent } from "@/lib/admin/guard";
import { testMessage } from "@/lib/push/messages";
import { notifyProfile, vapidConfig } from "@/lib/push/send";

/** "Gửi thử": a test notification to the signed-in parent's own devices only. */
export async function POST() {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  if (!vapidConfig()) return jsonError("Chưa cài khóa thông báo trên Vercel (xem hướng dẫn trên trang này).", 409);
  const result = await notifyProfile(guard.ctx.userId, testMessage());
  return NextResponse.json(result);
}
