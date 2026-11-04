import { NextResponse } from "next/server";
import { jsonError, readJson, requireParent } from "@/lib/admin/guard";
import { parseSubscription } from "@/lib/push/messages";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A parent turns notifications on / off for THIS device (S5). push_subscriptions has no
 * browser grants at all (0001), so the server writes it with service_role after checking
 * that the caller is a signed-in parent.
 */
export async function POST(request: Request) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const sub = parseSubscription(await readJson(request));
  if (!sub) return jsonError("Trình duyệt gửi thông tin thông báo không hợp lệ.", 400);
  const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 300) || null;
  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert(
      { profile_id: guard.ctx.userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent },
      { onConflict: "endpoint" },
    );
  if (error) {
    console.error("push subscribe failed", error.message);
    return jsonError("Chưa lưu được, thử lại sau.", 500);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const body = (await readJson(request)) as { endpoint?: unknown } | null;
  if (!body || typeof body.endpoint !== "string") return jsonError("Thiếu thông tin máy.", 400);
  const { error } = await createAdminClient().from("push_subscriptions").delete().eq("endpoint", body.endpoint).eq("profile_id", guard.ctx.userId);
  if (error) return jsonError("Chưa tắt được, thử lại sau.", 500);
  return NextResponse.json({ ok: true });
}
