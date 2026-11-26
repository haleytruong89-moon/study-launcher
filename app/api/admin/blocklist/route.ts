import { NextResponse } from "next/server";
import { domainFromInput } from "@/lib/admin/allowlist";
import { blockAddSchema, blockDomainProblem } from "@/lib/admin/blocklist";
import { firstIssue, jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";

function launcherHost(request: Request): string | null {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).hostname.toLowerCase();
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
  const problem = blockDomainProblem(d.domain, launcherHost(request));
  if (problem) return jsonError(problem, 400);

  const { error } = await ctx.db
    .from("always_block_entries")
    .upsert({ family_id: ctx.familyId, domain: d.domain, created_by: ctx.userId }, { onConflict: "family_id,domain", ignoreDuplicates: true });
  if (error) {
    console.error("blocklist add failed", error.message);
    return jsonError("Không lưu được.", 500);
  }
  await writeAudit(ctx, "blocklist.add", { domain: d.domain });
  return NextResponse.json({ ok: true, domain: d.domain });
}
