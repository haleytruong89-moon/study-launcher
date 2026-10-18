import { NextResponse } from "next/server";
import { allowAddSchema, domainFromInput, expiresAt, permanentProblem } from "@/lib/admin/allowlist";
import { firstIssue, isFamilyChild, jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";

/** Parent adds a site the children may open while locked (for one child or both). */
export async function POST(request: Request) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = allowAddSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
  const b = parsed.data;
  const d = domainFromInput(b.domain);
  if (!d.ok) return jsonError(d.error, 400);
  if (b.duration === "permanent") {
    const problem = permanentProblem(d.domain);
    if (problem) return jsonError(problem, 400);
  }
  if (b.childId && !(await isFamilyChild(ctx.db, b.childId))) return jsonError("Không tìm thấy tài khoản con.", 400);

  const row = {
    family_id: ctx.familyId,
    child_id: b.childId,
    domain: d.domain,
    grp: "external",
    expires_at: expiresAt(b.duration, new Date()),
    created_by: ctx.userId,
  };
  const { data, error } = await ctx.db.from("allowlist_entries").insert(row).select("id").single();
  if (error || !data) {
    console.error("allowlist add failed", error?.message);
    return jsonError("Không lưu được.", 500);
  }
  await writeAudit(ctx, "allowlist.add", { id: data.id, domain: d.domain, child_id: b.childId, expires_at: row.expires_at });
  return NextResponse.json({ ok: true, id: data.id, domain: d.domain });
}
