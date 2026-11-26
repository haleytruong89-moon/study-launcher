import { NextResponse } from "next/server";
import { domainFromInput } from "@/lib/admin/allowlist";
import { blockAddSchema, blockDomain, blockDomainProblem } from "@/lib/admin/blocklist";
import { firstIssue, jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";

function hostOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** "Luôn chặn" (V1): parent adds a site blocked in every state, for the whole family. */
export async function POST(request: Request) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = blockAddSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
  const d = domainFromInput(parsed.data.domain);
  if (!d.ok) return jsonError(d.error, 400);
  const domain = blockDomain(d.domain);
  const problem = blockDomainProblem(domain, hostOf(process.env.NEXT_PUBLIC_APP_URL) ?? hostOf(request.url), hostOf(process.env.NEXT_PUBLIC_SUPABASE_URL));
  if (problem) return jsonError(problem, 400);

  const { error } = await ctx.db
    .from("always_block_entries")
    .upsert({ family_id: ctx.familyId, domain, created_by: ctx.userId }, { onConflict: "family_id,domain", ignoreDuplicates: true });
  if (error) {
    console.error("blocklist add failed", error.message);
    return jsonError("Không lưu được.", 500);
  }
  await writeAudit(ctx, "blocklist.add", { domain });
  return NextResponse.json({ ok: true, domain });
}
