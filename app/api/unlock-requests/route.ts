import { after, NextResponse } from "next/server";
import { z } from "zod";
import { requestSchema, requestUrl } from "@/lib/admin/allowlist";
import { isBlockedHost } from "@/lib/admin/blocklist";
import { hostnameOf } from "@/lib/admin/schemas";
import { unlockReminderMessage, unlockRequestMessage } from "@/lib/push/messages";
import { remindDue } from "@/lib/push/remind";
import { notifyParents } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, requireChild, serverError, type ChildContext } from "@/lib/today/service";

/**
 * "Xin mở trang" (S3d): the child asks to open a blocked site; the parent decides on their
 * phone. One pending request per child + site (unique index). Written by the server.
 *
 * 25/11/2026: a very long address is cut to its page instead of refused; asking again for a
 * site that still waits tells the parents again (at most once every 10 minutes); every push
 * writes how many parent phones got it to the Nhật ký ("push.request").
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Chưa đọc được địa chỉ trang. Con thử lại nhé.", 400);
  const url = requestUrl(parsed.data.url);
  const domain = url ? hostnameOf(url) : null;
  if (!url || !domain) return jsonError("Chỉ xin mở được trang web (http/https).", 400);

  try {
    const admin = createAdminClient();
    // V1 (0031): a site on the family's "Luôn chặn" list is refused at once; a request the
    // parent might approve would still be blocked by the extension.
    const blocked = await admin.from("always_block_entries").select("domain").eq("family_id", ctx.familyId);
    if (!blocked.error && isBlockedHost(domain, (blocked.data ?? []).map((r) => r.domain as string))) {
      return jsonError("Trang này bố mẹ đã chặn hẳn.", 400);
    }
    const existing = await admin
      .from("unlock_requests")
      .select("id, status, created_at")
      .eq("child_id", ctx.childId)
      .eq("domain", domain)
      .eq("status", "pending")
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) {
      const id = existing.data.id as string;
      const last = await admin
        .from("audit_log")
        .select("created_at")
        .eq("family_id", ctx.familyId)
        .eq("action", "request.remind")
        .contains("payload", { id })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastToldAt = (last.data?.created_at as string | undefined) ?? (existing.data.created_at as string);
      if (!remindDue(lastToldAt, new Date())) return NextResponse.json({ id, status: "pending", reminded: false });
      await admin.from("audit_log").insert({ family_id: ctx.familyId, actor_id: ctx.childId, action: "request.remind", payload: { id, domain } });
      after(() => tell(ctx, id, domain, true));
      return NextResponse.json({ id, status: "pending", reminded: true });
    }

    const { data, error } = await admin
      .from("unlock_requests")
      .insert({ family_id: ctx.familyId, child_id: ctx.childId, url, domain, reason: parsed.data.reason })
      .select("id, status")
      .single();
    if (error || !data) throw new Error(error?.message ?? "insert failed");
    await admin.from("audit_log").insert({ family_id: ctx.familyId, actor_id: ctx.childId, action: "request.create", payload: { id: data.id, domain } });
    after(() => tell(ctx, data.id as string, domain, false));
    return NextResponse.json({ id: data.id, status: data.status });
  } catch (e) {
    return serverError("unlock.create", e);
  }
}

/** Pushes to the parents' phones, then notes in the Nhật ký how many phones got it. Never throws. */
async function tell(ctx: ChildContext, id: string, domain: string, remind: boolean) {
  const message = remind ? unlockReminderMessage(ctx.displayName, domain) : unlockRequestMessage(ctx.displayName, domain);
  const r = await notifyParents(ctx.familyId, message);
  const { error } = await createAdminClient()
    .from("audit_log")
    .insert({ family_id: ctx.familyId, actor_id: ctx.childId, action: "push.request", payload: { id, domain, remind, sent: r.sent, failed: r.failed, removed: r.removed } });
  if (error) console.error("push.request audit failed", error.message);
}

/** The child checks one of their requests (RLS: own rows only). */
export async function GET(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const id = z.uuid().safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) return jsonError("Không tìm thấy.", 404);
  const { data } = await guard.ctx.db.from("unlock_requests").select("id, status, domain").eq("id", id.data).maybeSingle();
  if (!data) return jsonError("Không tìm thấy.", 404);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
