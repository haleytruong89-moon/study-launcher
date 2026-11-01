import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { MAX_FILES_PER_RUN } from "@/lib/cleanup/rules";
import { planBytes, planFamily, removeFiles } from "@/lib/cleanup/run";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * S3e weekly photo cleanup (DESIGN §9–§10). Called once a week by
 * .github/workflows/photo-cleanup.yml with the CRON_SECRET.
 *
 * Deletes FILES only (proof photos; homework files of items archived/done long ago) older
 * than family_settings.photo_retention_days. Database rows are never deleted or changed.
 * `?dryRun=1` only counts. At most MAX_FILES_PER_RUN files per run. Logs counts only, never
 * paths of the children's files.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const ok = !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const now = new Date();
  const found = { proofs: 0, homework: 0 };
  const deleted = { proofs: 0, homework: 0 };
  let bytes = 0;
  let more = false;
  let skipped = 0;

  try {
    const admin = createAdminClient();
    const families = await admin.from("families").select("id");
    if (families.error) throw new Error(families.error.message);
    for (const f of families.data ?? []) {
      const familyId = f.id as string;
      const budget = MAX_FILES_PER_RUN - found.proofs - found.homework;
      if (budget <= 0) {
        more = true;
        break;
      }
      const plan = await planFamily(admin, familyId, now, budget);
      if (!plan) {
        skipped++;
        continue;
      }
      found.proofs += plan.proofs.length;
      found.homework += plan.homework.length;
      bytes += planBytes(plan);
      more ||= plan.more;
      if (dryRun || plan.proofs.length + plan.homework.length === 0) continue;

      deleted.proofs += await removeFiles(admin, "proofs", plan.proofs);
      deleted.homework += await removeFiles(admin, "homework", plan.homework);
      const { error } = await admin.from("audit_log").insert({
        family_id: familyId,
        actor_id: null,
        action: "photos.cleanup",
        payload: { proofs: plan.proofs.length, homework: plan.homework.length, bytes: planBytes(plan), retentionDays: plan.retentionDays, before: plan.cutoff },
      });
      if (error) console.error("cron cleanup: audit_log insert failed", error.message);
    }
    const result = { ok: true, dryRun, found, deleted, bytes, more, skippedFamilies: skipped };
    console.log("cron cleanup", JSON.stringify(result));
    return NextResponse.json(result);
  } catch (e) {
    console.error("cron cleanup failed", JSON.stringify({ dryRun, found, deleted }), e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "failed", deleted }, { status: 500 });
  }
}
