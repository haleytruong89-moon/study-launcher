import { NextResponse } from "next/server";
import { z } from "zod";
import { permanentProblem } from "@/lib/admin/allowlist";
import { jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";
import { presetById } from "@/lib/admin/presets";

/** "Thêm nhanh": adds a bundle of domains for BOTH children, always (skips ones already there). */
export async function POST(request: Request) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = z.object({ preset: z.string() }).safeParse(await readJson(request));
  const preset = parsed.success ? presetById(parsed.data.preset) : undefined;
  if (!preset) return jsonError("Không có nhóm trang này.", 400);
  const domains = preset.domains.filter((d) => permanentProblem(d) === null);

  const { data: existing, error: readErr } = await ctx.db
    .from("allowlist_entries")
    .select("domain")
    .is("child_id", null)
    .is("expires_at", null)
    .in("domain", domains);
  if (readErr) return jsonError("Không đọc được danh sách.", 500);
  const have = new Set((existing ?? []).map((r) => r.domain as string));
  const missing = domains.filter((d) => !have.has(d));
  if (missing.length > 0) {
    const { error } = await ctx.db
      .from("allowlist_entries")
      .insert(missing.map((domain) => ({ family_id: ctx.familyId, child_id: null, domain, grp: "external", expires_at: null, created_by: ctx.userId })));
    if (error) {
      console.error("allowlist preset failed", error.message);
      return jsonError("Không lưu được.", 500);
    }
  }
  await writeAudit(ctx, "allowlist.preset", { preset: preset.id, added: missing });
  return NextResponse.json({ ok: true, added: missing });
}
