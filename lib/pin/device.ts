import "server-only";
import { cookies } from "next/headers";
import { hashToken, newDeviceToken } from "@/lib/ext/secrets";
import { createAdminClient } from "@/lib/supabase/admin";
import { PIN_DEVICE_COOKIE } from "./rules";

const MAX_AGE = 400 * 24 * 3600; // browsers cap cookies at 400 days

/** The remembered-browser token from the httpOnly cookie, or null. */
export async function deviceToken(): Promise<string | null> {
  const v = (await cookies()).get(PIN_DEVICE_COOKIE)?.value;
  return v && /^[A-Za-z0-9_-]{40,60}$/.test(v) ? v : null;
}

/** Marks this browser as one where the child may sign in with the PIN (server only). */
export async function rememberDevice(childId: string, familyId: string): Promise<void> {
  const store = await cookies();
  let token = await deviceToken();
  if (!token) token = newDeviceToken();
  const { error } = await createAdminClient()
    .from("pin_devices")
    .upsert({ child_id: childId, family_id: familyId, token_hash: hashToken(token), last_used_at: new Date().toISOString(), revoked_at: null }, { onConflict: "token_hash,child_id" });
  if (error) throw new Error(error.message);
  store.set(PIN_DEVICE_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: MAX_AGE });
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
