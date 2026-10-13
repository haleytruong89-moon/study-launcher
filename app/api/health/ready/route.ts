import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EXPECTED_BUCKETS,
  EXPECTED_TABLES,
  REQUIRED_ENV,
  evaluateReadiness,
  type ReadinessInput,
} from "@/lib/readiness";

export const dynamic = "force-dynamic";

/**
 * "Is this deployment correctly set up?" — returns pass/fail per check, never values or secrets.
 * Public on purpose: it only reveals booleans and names of missing items.
 */
export async function GET(request: Request) {
  const envMissing = REQUIRED_ENV.filter((name) => !process.env[name]);

  const input: ReadinessInput = {
    envMissing,
    dbReachable: null,
    tablesMissing: [],
    bucketsMissing: [],
    signupDisabled: null,
    hostMatchesAppUrl: null,
    familyExists: null,
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      input.hostMatchesAppUrl = new URL(appUrl).host === new URL(request.url).host;
    } catch {
      input.hostMatchesAppUrl = false;
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && anonKey) {
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
        headers: { apikey: anonKey },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const settings = (await res.json()) as { disable_signup?: boolean };
        input.signupDisabled = typeof settings.disable_signup === "boolean" ? settings.disable_signup : null;
      }
    } catch {
      // leave as null (= unknown, reported as a failed check)
    }
  }

  if (envMissing.length === 0) {
    try {
      const admin = createAdminClient();
      const missing: string[] = [];
      let reachable = false;
      let familyExists: boolean | null = null;

      await Promise.all(
        EXPECTED_TABLES.map(async (table) => {
          const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
          if (error) missing.push(table);
          else reachable = true;
          if (table === "families" && !error) familyExists = (count ?? 0) > 0;
        }),
      );

      const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
      if (!bucketError) reachable = true;
      const found = new Set((buckets ?? []).map((b) => b.id));

      input.dbReachable = reachable;
      input.tablesMissing = missing.sort();
      input.bucketsMissing = bucketError ? [...EXPECTED_BUCKETS] : EXPECTED_BUCKETS.filter((b) => !found.has(b));
      input.familyExists = familyExists;
    } catch {
      input.dbReachable = false;
    }
  }

  return NextResponse.json(evaluateReadiness(input));
}
