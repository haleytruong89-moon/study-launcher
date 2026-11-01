import { after, NextResponse } from "next/server";
import { z } from "zod";
import { requestSchema } from "@/lib/admin/allowlist";
import { hostnameOf } from "@/lib/admin/schemas";
import { unlockRequestMessage } from "@/lib/push/messages";
import { notifyParents } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, requireChild, serverError } from "@/lib/today/service";

/**
 * "Xin mở trang" (S3d): the child asks to open a blocked site; the parent decides on their
 * phone. One pending request per child + site (unique index). Written by the server.
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Thiếu địa chỉ trang.", 400);
  const domain = hostnameOf(parsed.data.url);
  if (!domain) return jsonError("Chỉ xin mở được trang web (http/https).", 400);

  try {
    const admin = createAdminClient();
    const existing = await admin.from("unlock_requests").select("id, status").eq("child_id", ctx.childId).eq("domain", domain).eq("status", "pending").maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) return NextResponse.json({ id: existing.data.id, status: "pending" });

    const { data, error } = await admin
      .from("unlock_requests")
      .insert({ family_id: ctx.familyId, child_id: ctx.childId, url: parsed.data.url, domain, reason: parsed.data.reason })
      .select("id, status")
      .single();
    if (error || !data) throw new Error(error?.message ?? "insert failed");
    await admin.from("audit_log").insert({ family_id: ctx.familyId, actor_id: ctx.childId, action: "request.create", payload: { id: data.id, domain } });
    // S5: tell the parents' phones (only for a NEW request; asking again does not push again).
    after(() => notifyParents(ctx.familyId, unlockRequestMessage(ctx.displayName, domain)));
    return NextResponse.json({ id: data.id, status: data.status });
  } catch (e) {
    return serverError("unlock.create", e);
  }
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
