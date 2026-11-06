import "server-only";
import { after } from "next/server";
import { wantTalkMessage, wantTalkReminderMessage } from "@/lib/push/messages";
import { notifyParents, notifyProfile, vapidConfig } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ChildContext } from "@/lib/today/service";
import { bySettings } from "./session";
import {
  ESCALATE_AFTER_MINUTES,
  ESCALATE_WINDOW_HOURS,
  STATUS_POLL_MS,
  STATUS_SHOW_HOURS,
  TALK_GAP_SECONDS,
  escalationTarget,
  talkAvailable,
  talkStatus,
  type SignalKind,
  type SignalRow,
  type TalkStatus,
} from "./rules";

/**
 * "Con muốn nói chuyện" (BINH_YEN.md §4, §6, R3). Works whether or not Góc bình yên is on,
 * and never needs the Góc bình yên PIN (one tap). Content-free: a row says only WHO and WHEN.
 */

export interface TalkParent {
  id: string;
  name: string;
}

export interface TalkInfo {
  /** Offered only when a push can reach at least one parent's phone. */
  available: boolean;
  /** Parents with notifications on (the child may pick one); first = default order of creation. */
  parents: TalkParent[];
  /** The child's last signal, while it is still worth showing. */
  status: TalkStatus | null;
  pollMs: number;
  /** Góc bình yên is on for this family (Hôm nay shows the way in). */
  corner: boolean;
  serverNow: string;
}

/** Parents of the family that have at least one device with notifications on. [] when push is not set up. */
export async function talkRecipients(familyId: string): Promise<TalkParent[]> {
  if (!vapidConfig()) return [];
  const admin = createAdminClient();
  const { data: parents, error } = await admin.from("profiles").select("id, display_name").eq("family_id", familyId).eq("role", "parent").order("created_at");
  if (error || !parents?.length) return [];
  const { data: subs, error: subErr } = await admin
    .from("push_subscriptions")
    .select("profile_id")
    .in(
      "profile_id",
      parents.map((p) => p.id as string),
    );
  if (subErr) return [];
  const withPush = new Set((subs ?? []).map((s) => s.profile_id as string));
  return parents.filter((p) => withPush.has(p.id as string)).map((p) => ({ id: p.id as string, name: p.display_name as string }));
}

/** The child's latest signal; `ok: false` when the table cannot be read (e.g. a preview before migration 0008). */
async function latestSignal(childId: string, now: Date): Promise<{ ok: boolean; row: SignalRow | null }> {
  const since = new Date(now.getTime() - STATUS_SHOW_HOURS * 3600_000).toISOString();
  const { data, error } = await createAdminClient()
    .from("by_signals")
    .select("id, kind, to_parent_id, created_at, seen_at, seen_by, escalated_at")
    .eq("child_id", childId)
    .eq("kind", "want_talk")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, row: null };
  return { ok: true, row: (data as SignalRow | null) ?? null };
}

export async function talkInfo(ctx: ChildContext, now = new Date()): Promise<TalkInfo> {
  const [parents, last, settings] = await Promise.all([talkRecipients(ctx.familyId), latestSignal(ctx.childId, now), bySettings(ctx.familyId)]);
  return {
    // No signal table yet = nothing could be stored: never offer the button then.
    available: last.ok && talkAvailable(!!vapidConfig(), parents.length),
    parents,
    status: talkStatus(last.row, now),
    pollMs: STATUS_POLL_MS,
    corner: settings.enabled,
    serverNow: now.toISOString(),
  };
}

export type SendTalkResult =
  | { ok: true; info: TalkInfo; delivered: boolean | null; repeated: boolean }
  | { ok: false; status: number; error: string };

/** Creates the signal (rate limited in the database) and pushes a generic message. */
export async function sendTalk(ctx: ChildContext, kind: SignalKind, to: string | null, now = new Date()): Promise<SendTalkResult> {
  const recipients = await talkRecipients(ctx.familyId);
  if (!talkAvailable(!!vapidConfig(), recipients.length)) {
    return { ok: false, status: 409, error: "Điện thoại của bố mẹ chưa bật thông báo. Con hãy tìm bố mẹ trực tiếp nhé." };
  }
  if (to && !recipients.some((p) => p.id === to)) return { ok: false, status: 400, error: "Không tìm thấy người nhận." };

  const { data, error } = await createAdminClient().rpc("by_signal_create", { p_child: ctx.childId, p_kind: kind, p_to: to, p_gap_seconds: TALK_GAP_SECONDS });
  if (error) throw new Error("by_signal_create");
  const created = Array.isArray(data) ? data.length > 0 : !!data;
  let delivered: boolean | null = null;
  if (created) {
    const message = wantTalkMessage(ctx.displayName);
    const result = to ? await notifyProfile(to, message) : await notifyParents(ctx.familyId, message);
    delivered = result.sent > 0;
  }
  return { ok: true, info: await talkInfo(ctx, now), delivered, repeated: !created };
}

/**
 * Re-pushes every needs_care signal nobody marked "Đã thấy" after 10 minutes, ONCE. "Con muốn
 * nói chuyện" (want_talk) is never re-pushed: parent decision 05/11/2026 — the child is told to
 * find a parent in person instead (talkStatus). (escalated_at is set
 * in the same UPDATE that picks the rows, so two runs at the same time cannot both send).
 * Called by the cron job and opportunistically by the children's requests. Never throws.
 */
export async function escalateDue(now = new Date(), familyId?: string): Promise<number> {
  try {
    const admin = createAdminClient();
    const cutoff = new Date(now.getTime() - ESCALATE_AFTER_MINUTES * 60_000).toISOString();
    const oldest = new Date(now.getTime() - ESCALATE_WINDOW_HOURS * 3600_000).toISOString();
    let q = admin
      .from("by_signals")
      .update({ escalated_at: now.toISOString() })
      .eq("kind", "needs_care")
      .is("seen_at", null)
      .is("escalated_at", null)
      .lte("created_at", cutoff)
      .gte("created_at", oldest);
    if (familyId) q = q.eq("family_id", familyId);
    const { data, error } = await q.select("id, family_id, child_id, kind, to_parent_id");
    if (error) throw new Error("escalate select");
    for (const s of data ?? []) {
      const { data: kid } = await admin.from("profiles").select("display_name").eq("id", s.child_id as string).maybeSingle();
      const message = wantTalkReminderMessage((kid?.display_name as string | undefined) ?? "Con");
      const target = escalationTarget({ kind: s.kind as string, to_parent_id: (s.to_parent_id as string | null) ?? null });
      if (target.all) await notifyParents(s.family_id as string, message);
      else await notifyProfile(target.parentId, message);
    }
    return data?.length ?? 0;
  } catch (e) {
    console.error("by escalate failed", e instanceof Error ? e.message : "error");
    return 0;
  }
}

/** Runs the escalation for this family after the response is sent (does not slow the child's request). */
export function escalateSoon(familyId: string): void {
  try {
    after(async () => {
      await escalateDue(new Date(), familyId);
    });
  } catch {
    /* outside a request (tests): skip */
  }
}
