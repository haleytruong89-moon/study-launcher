import { cookies } from "next/headers";
import { AUTH_LOST_COOKIE, AUTH_LOST_MAX_AGE, encodeLost, hasAuthCookie, lostCode } from "@/lib/authLost";
import { createClient } from "@/lib/supabase/server";

export type Role = "parent" | "child";

export interface CurrentUser {
  userId: string;
  email: string | undefined;
  /** null when the auth user exists but no profile has been created yet (first-run setup). */
  profile: {
    id: string;
    family_id: string;
    role: Role;
    display_name: string;
    grade: number | null;
    color: string | null;
  } | null;
}

/** Returns the signed-in user and profile, or null when not signed in. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    await noteLost(error);
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, family_id, role, display_name, grade, color")
    .eq("id", data.user.id)
    .maybeSingle();

  return {
    userId: data.user.id,
    email: data.user.email,
    profile: profile ? { ...profile, role: profile.role as Role } : null,
  };
}

/**
 * 18/11/2026: a session cookie came in but no user came out (API routes skip proxy.ts, so they
 * notice it here). Keeps the first reason in an httpOnly cookie for the next PIN login's journal
 * line. Server Components cannot write cookies: there it only logs.
 */
async function noteLost(error: unknown): Promise<void> {
  try {
    const store = await cookies();
    if (!hasAuthCookie(store.getAll().map((c) => c.name)) || store.get(AUTH_LOST_COOKIE)) return;
    const code = lostCode(error);
    console.warn("auth.session_lost", code);
    try {
      store.set(AUTH_LOST_COOKIE, encodeLost({ code, at: new Date().toISOString(), path: "api" }), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: AUTH_LOST_MAX_AGE });
    } catch {
      // A Server Component: proxy.ts notes it on the next page load.
    }
  } catch {
    // Outside a request (tests, scripts): nothing to note.
  }
}
