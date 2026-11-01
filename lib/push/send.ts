import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PushMessage } from "./messages";

/** VAPID keys from the environment; null while the parent has not set them up yet (push is then off). */
export function vapidConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface SendResult {
  sent: number;
  /** Subscriptions the push service no longer knows (removed from the table). */
  removed: number;
  failed: number;
}

/**
 * Sends one message to the given subscriptions. NEVER throws: a push problem must not break
 * the child's or the parent's action. Gone subscriptions (404 / 410) are removed.
 */
async function sendTo(rows: SubscriptionRow[], message: PushMessage): Promise<SendResult> {
  const result: SendResult = { sent: 0, removed: 0, failed: 0 };
  const config = vapidConfig();
  if (!config || rows.length === 0) return result;

  const payload = JSON.stringify(message);
  const gone: string[] = [];
  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, {
          vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
          TTL: 12 * 60 * 60, // a phone that is off for the night still gets it in the morning
          urgency: "high",
          timeout: 8000,
        });
        result.sent += 1;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(row.id);
        else {
          result.failed += 1;
          // Never log the endpoint or payload: only the status.
          console.error("push send failed", status ?? (e instanceof Error ? e.name : "error"));
        }
      }
    }),
  );
  if (gone.length > 0) {
    const { error } = await createAdminClient().from("push_subscriptions").delete().in("id", gone);
    if (!error) result.removed = gone.length;
  }
  return result;
}

/** Every parent device of the family that turned notifications on. */
export async function notifyParents(familyId: string, message: PushMessage): Promise<SendResult> {
  try {
    if (!vapidConfig()) return { sent: 0, removed: 0, failed: 0 };
    const admin = createAdminClient();
    const parents = await admin.from("profiles").select("id").eq("family_id", familyId).eq("role", "parent");
    if (parents.error) throw new Error(parents.error.message);
    const ids = (parents.data ?? []).map((p) => p.id as string);
    if (ids.length === 0) return { sent: 0, removed: 0, failed: 0 };
    const subs = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("profile_id", ids);
    if (subs.error) throw new Error(subs.error.message);
    return await sendTo((subs.data ?? []) as SubscriptionRow[], message);
  } catch (e) {
    console.error("notifyParents failed", e instanceof Error ? e.message : e);
    return { sent: 0, removed: 0, failed: 1 };
  }
}

/** Only the devices of one person (the "Gửi thử" button). */
export async function notifyProfile(profileId: string, message: PushMessage): Promise<SendResult> {
  try {
    const subs = await createAdminClient().from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("profile_id", profileId);
    if (subs.error) throw new Error(subs.error.message);
    return await sendTo((subs.data ?? []) as SubscriptionRow[], message);
  } catch (e) {
    console.error("notifyProfile failed", e instanceof Error ? e.message : e);
    return { sent: 0, removed: 0, failed: 1 };
  }
}
