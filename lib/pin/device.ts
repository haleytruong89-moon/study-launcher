import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";
import { hashToken, newDeviceToken } from "@/lib/ext/secrets";
import { createAdminClient } from "@/lib/supabase/admin";
import { PIN_DEVICE_COOKIE, staleAfterRevoke } from "./rules";

const MAX_AGE = 400 * 24 * 3600; // browsers cap cookies at 400 days

/** audit_log action written when a parent signs a child out of every browser. */
const SESSIONS_REVOKED = "child.sessions_revoked";

/** The remembered-browser token from the httpOnly cookie, or null. */
export async function deviceToken(): Promise<string | null> {
  const v = (await cookies()).get(PIN_DEVICE_COOKIE)?.value;
  return v && /^[A-Za-z0-9_-]{40,60}$/.test(v) ? v : null;
}

/**
 * Marks this browser as one where the child may sign in with the PIN (server only).
 * `issuedAtSec` = the session token's `iat`: a session older than the parent's last
 * "sign out everywhere" may not remember (or un-forget) a browser. Returns false then.
 */
export async function rememberDevice(childId: string, familyId: string, issuedAtSec: number | null): Promise<boolean> {
  const store = await cookies();
  const admin = createAdminClient();
  const { data: last, error: lastErr } = await admin
    .from("audit_log")
    .select("created_at")
    .eq("family_id", familyId)
    .eq("action", SESSIONS_REVOKED)
    .eq("payload->>child_id", childId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastErr) throw new Error(lastErr.message);
  if (staleAfterRevoke(issuedAtSec, (last?.created_at as string | null | undefined) ?? null)) return false;
  let token = await deviceToken();
  if (!token) token = newDeviceToken();
  const { error } = await admin
    .from("pin_devices")
    .upsert({ child_id: childId, family_id: familyId, token_hash: hashToken(token), last_used_at: new Date().toISOString(), revoked_at: null }, { onConflict: "token_hash,child_id" });
  if (error) throw new Error(error.message);
  store.set(PIN_DEVICE_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: MAX_AGE });
  return true;
}

export interface RememberedChild {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  hasPin: boolean;
}

/** Children remembered on this browser (for the login screen). Empty without the cookie. */
export async function rememberedChildren(): Promise<RememberedChild[]> {
  const token = await deviceToken();
  if (!token) return [];
  const admin = createAdminClient();
  const { data: rows, error } = await admin.from("pin_devices").select("child_id").eq("token_hash", hashToken(token)).is("revoked_at", null);
  if (error || !rows?.length) return [];
  const { data: kids } = await admin
    .from("profiles")
    .select("id, display_name, color, icon, pin_hash, role")
    .in(
      "id",
      rows.map((r) => r.child_id as string),
    )
    .eq("role", "child")
    .order("created_at");
  return (kids ?? []).map((k) => ({ id: k.id as string, name: k.display_name as string, color: (k.color as string | null) ?? null, icon: (k.icon as string | null) ?? null, hasPin: !!k.pin_hash }));
}

/**
 * Signs the child out of EVERY browser and forgets every remembered PIN browser (audit
 * 24/10: a password reset left old laptops signed in and able to use the PIN).
 *
 * Supabase can only end "all sessions" from one of the user's own tokens, so the server
 * opens a throw-away session for the child (magic link verified in memory, no cookie) and
 * signs out globally with it. Access tokens already handed out still work until they expire
 * (at most 1 hour); `rememberDevice` refuses tokens older than the revoke, so such a stale
 * session cannot re-remember a browser either.
 */
export async function signOutChildEverywhere(childId: string, familyId: string, actorId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: user, error: userErr } = await admin.auth.admin.getUserById(childId);
  if (userErr || !user.user?.email) throw new Error(userErr?.message ?? "child has no email");
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.user.email });
  if (linkErr || !link.properties?.hashed_token) throw new Error(linkErr?.message ?? "no magic link");
  const env = serverEnv();
  const temp = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: otp, error: otpErr } = await temp.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (otpErr || !otp.session) throw new Error(otpErr?.message ?? "no session");
  const { error: outErr } = await admin.auth.admin.signOut(otp.session.access_token, "global");
  if (outErr) throw new Error(outErr.message);
  // After the sign-out, so the throw-away token is older than this marker too. It is the
  // line `rememberDevice` checks; a failed write must not pass silently.
  const { error: markErr } = await admin.from("audit_log").insert({ family_id: familyId, actor_id: actorId, action: SESSIONS_REVOKED, payload: { child_id: childId } });
  if (markErr) throw new Error(markErr.message);
  const { error: revErr } = await admin.from("pin_devices").update({ revoked_at: new Date().toISOString() }).eq("child_id", childId).is("revoked_at", null);
  if (revErr) throw new Error(revErr.message);
}

/** "Quên máy này" on the login screen: this browser stops offering PIN login. */
export async function forgetThisDevice(): Promise<void> {
  const store = await cookies();
  const token = await deviceToken();
  if (token) {
    await createAdminClient().from("pin_devices").update({ revoked_at: new Date().toISOString() }).eq("token_hash", hashToken(token)).is("revoked_at", null);
  }
  store.delete(PIN_DEVICE_COOKIE);
}
