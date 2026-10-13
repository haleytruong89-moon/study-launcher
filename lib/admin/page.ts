import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface ChildSummary {
  id: string;
  display_name: string;
  grade: number | null;
  color: string | null;
  bedtime: string;
}

/** Server-component guard for /parent/* pages: redirects anyone who is not a parent. */
export async function requireParentPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.profile) redirect("/setup");
  if (me.profile.role !== "parent") redirect("/today");
  const db = await createClient();
  return { me: { ...me, profile: me.profile }, db };
}

export async function loadChildren(db: SupabaseClient): Promise<ChildSummary[]> {
  const { data } = await db
    .from("profiles")
    .select("id, display_name, grade, color, bedtime")
    .eq("role", "child")
    .order("created_at");
  return (data ?? []) as ChildSummary[];
}
