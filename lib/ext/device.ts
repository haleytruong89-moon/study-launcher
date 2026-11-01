import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { bearer, hashToken } from "./secrets";

/** Marks the parent's "Con nhờ" entries that the extension created by itself (blocked frames). */
export const AUTO_REASON_PREFIX = "Tự phát hiện:";

export interface Device {
  id: string;
  childId: string;
  familyId: string;
}

/** The paired laptop behind a request's Bearer device token, or null (unknown / revoked). */
export async function deviceFromRequest(request: Request): Promise<Device | null> {
  const token = bearer(request);
  if (!token) return null;
  const { data, error } = await createAdminClient()
    .from("extension_devices")
    .select("id, child_id, family_id, revoked_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.revoked_at) return null;
  return { id: data.id as string, childId: data.child_id as string, familyId: data.family_id as string };
}
