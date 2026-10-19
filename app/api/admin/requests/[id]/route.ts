import { NextResponse } from "next/server";
import { z } from "zod";
import { DECISION_DURATION, DECISION_STATUS, decisionSchema, expiresAt, permanentProblem, wideDomainOffer } from "@/lib/admin/allowlist";
import { jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";

/** Parent decides a "Xin mở trang": 15 minutes / rest of today / always (this site or its whole domain) / no. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return jsonError("Không tìm thấy.", 404);
  const parsed = decisionSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("Thiếu lựa chọn.", 400);
  const decision = parsed.data.decision;

  const { data: req, error: readErr } = await ctx.db.from("unlock_requests").select("id, child_id, domain, status").eq("id", id.data).maybeSingle();
  if (readErr) return jsonError("Không đọc được yêu cầu.", 500);
  if (!req) return jsonError("Không tìm thấy.", 404);
  if (req.status !== "pending") return jsonError("Yêu cầu này đã được trả lời.", 409);
  if (decision === "permanent") {
    const problem = permanentProblem(req.domain);
    if (problem) return jsonError(problem, 400);
  }
  // "Luôn cho phép cả zalo.me": the server recomputes the wider domain, never trusts the client.
  const allowDomain = decision === "permanent_base" ? wideDomainOffer(req.domain) : req.domain;
  if (!allowDomain) return jsonError("Không mở rộng được tên miền này. Chọn “Luôn cho phép” trang này thôi.", 400);

  const now = new Date();
  // Decide first (guarded: a second tap or another parent finds nothing to update).
  const upd = await ctx.db
    .from("unlock_requests")
    .update({ status: DECISION_STATUS[decision], decided_at: now.toISOString(), decided_by: ctx.userId })
    .eq("id", req.id)
    .eq("status", "pending")
    .select("id");
  if (upd.error) return jsonError("Không lưu được.", 500);
  if (!upd.data || upd.data.length === 0) return jsonError("Yêu cầu này đã được trả lời.", 409);

  if (decision !== "deny") {
    const { error } = await ctx.db.from("allowlist_entries").insert({
      family_id: ctx.familyId,
      child_id: req.child_id,
      domain: allowDomain,
      grp: "request",
      expires_at: expiresAt(DECISION_DURATION[decision], now),
      created_by: ctx.userId,
    });
    if (error) {
      console.error("request allow insert failed", error.message);
      return jsonError("Đã ghi quyết định nhưng chưa mở được trang, thử “Trang học”.", 500);
    }
  }
  await writeAudit(ctx, `request.${decision}`, { id: req.id, child_id: req.child_id, domain: allowDomain, requested: req.domain });
  return NextResponse.json({ ok: true });
}
