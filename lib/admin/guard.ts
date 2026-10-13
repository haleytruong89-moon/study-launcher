import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ParentContext {
  userId: string;
  familyId: string;
  /** Acts as the signed-in parent: every write is still checked by RLS (parent_all policies). */
  db: SupabaseClient;
}

type Guarded = { ok: true; ctx: ParentContext } | { ok: false; response: NextResponse };

/**
 * Route-handler guard for /api/admin/*: signed in AND role parent.
 * Parents write with their OWN session (RLS-enforced), not service_role.
 */
export async function requireParent(): Promise<Guarded> {
  const me: CurrentUser | null = await getCurrentUser();
  if (!me) return { ok: false, response: jsonError("Bạn chưa đăng nhập.", 401) };
  if (me.profile?.role !== "parent") return { ok: false, response: jsonError("Chỉ phụ huynh mới làm được việc này.", 403) };
  const db = await createClient();
  return { ok: true, ctx: { userId: me.userId, familyId: me.profile.family_id, db } };
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Reads the JSON body; null when it is not valid JSON. */
export async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}

/** True when `childId` is a CHILD profile of the parent's family (RLS limits the lookup to the family). */
export async function isFamilyChild(db: SupabaseClient, childId: string): Promise<boolean> {
  const { data } = await db.from("profiles").select("id").eq("id", childId).eq("role", "child").maybeSingle();
  return data !== null;
}

/**
 * audit_log is server-written only (no insert grant for browsers), so this uses service_role.
 * Logging must never break the parent's action: failures are reported to the server log only.
 */
export async function writeAudit(ctx: ParentContext, action: string, payload: Record<string, unknown>) {
  try {
    const { error } = await createAdminClient()
      .from("audit_log")
      .insert({ family_id: ctx.familyId, actor_id: ctx.userId, action, payload });
    if (error) console.error("audit_log insert failed", action, error.message);
  } catch (e) {
    console.error("audit_log insert failed", action, e instanceof Error ? e.message : e);
  }
}

/** First Zod issue as a short Vietnamese message for the form. */
export function firstIssue(error: { issues: { message: string }[] }): string {
  const msg = error.issues[0]?.message;
  // Zod's own English messages are not shown to parents.
  return msg && /[À-ỹ]/.test(msg) ? msg : "Thiếu hoặc sai thông tin.";
}
