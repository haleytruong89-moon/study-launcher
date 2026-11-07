/**
 * Góc bình yên — S-BY0 rules (docs/BINH_YEN.md R3, R5, §4, §6). PURE: no I/O, no clock of its
 * own (every function takes `now` from the SERVER), so tests pin the exact behaviour and the
 * Vietnamese wording. Safe in browser and server code.
 */
import { vnTime } from "@/lib/today/view";

/** httpOnly cookie holding the Góc bình yên session token (only its SHA-256 is stored). */
export const BY_SESSION_COOKIE = "sl_by";
/** The cookie is sent only to these paths (one cookie per path, same token). */
export const BY_COOKIE_PATHS = ["/binh-yen", "/api/by"] as const;

/** "Con muốn nói chuyện": at most one per child (per kind) every 2 minutes. */
export const TALK_GAP_SECONDS = 120;
/**
 * Not seen after 10 minutes. Parent decision 05/11/2026: for "Con muốn nói chuyện" NO re-push —
 * the child is only told to find a parent in person. (needs_care, S-BY2: re-push to every parent, R3.)
 */
export const ESCALATE_AFTER_MINUTES = 10;
/** Only fairly recent signals are escalated (never a forgotten one days later, in the night). */
export const ESCALATE_WINDOW_HOURS = 6;
/** How long the child keeps seeing the status of their last signal. */
export const STATUS_SHOW_HOURS = 3;
/** The child's status is re-read this often while the screen is visible. */
export const STATUS_POLL_MS = 20_000;

/** Signal kinds the server accepts. needs_care comes with the text boxes (S-BY2). */
export const SIGNAL_KINDS = ["want_talk"] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];
export function isSignalKind(v: unknown): v is SignalKind {
  return typeof v === "string" && (SIGNAL_KINDS as readonly string[]).includes(v);
}

export const HOTLINE_TEXT = "gọi 111 (miễn phí, 24/7)";

// ---------------------------------------------------------------------------
// Visit (R5). Parent decision 07/11/2026: NO Góc bình yên PIN and NO idle lock — being logged
// in as the child opens the corner. The server still holds one "visit" (by_sessions) so the
// study-time limit counts from the moment the child came in (server clock).
// ---------------------------------------------------------------------------

/**
 * A visit the child left for longer than this (no request from the corner's screen, which asks
 * the server every minute while it is visible) is over: the next opening starts a new visit.
 * Nothing locks and nothing is asked — it only decides where the study-time limit starts.
 */
export const VISIT_GAP_MINUTES = 5;
/** While the corner is visible, the screen tells the server it is still there this often. */
export const VISIT_PING_MS = 60_000;

export interface SessionRow {
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
}

export type SessionVerdict = "open" | "stale" | "ended" | "none";

/**
 * Whether a Góc bình yên visit is still going on at `now` (server time).
 * - ended (study-time limit reached, or replaced by a newer visit) → "ended"
 * - no request for longer than VISIT_GAP_MINUTES → "stale" (the child left; a new visit starts next time)
 */
export function sessionVerdict(row: SessionRow | null, now: Date): SessionVerdict {
  if (!row) return "none";
  if (row.ended_at) return "ended";
  if (now.getTime() - Date.parse(row.last_seen_at) > VISIT_GAP_MINUTES * 60_000) return "stale";
  return "open";
}

// ---------------------------------------------------------------------------
// Signals ("Con muốn nói chuyện")
// ---------------------------------------------------------------------------

export interface SignalRow {
  id: string;
  kind: string;
  to_parent_id: string | null;
  created_at: string;
  seen_at: string | null;
  seen_by: string | null;
  escalated_at: string | null;
}

/** The button is offered only when a push can really reach a parent's phone. */
export function talkAvailable(vapidConfigured: boolean, parentsWithPush: number): boolean {
  return vapidConfigured && parentsWithPush > 0;
}

/** True when the same child sent the same kind less than TALK_GAP_SECONDS ago. */
export function rateLimited(lastCreatedAt: string | null, now: Date): boolean {
  return !!lastCreatedAt && now.getTime() - Date.parse(lastCreatedAt) < TALK_GAP_SECONDS * 1000;
}

/** needs_care only: unseen, never escalated, older than 10 minutes but younger than the window → re-push once. */
export function shouldEscalate(s: Pick<SignalRow, "kind" | "created_at" | "seen_at" | "escalated_at">, now: Date): boolean {
  if (s.kind !== "needs_care") return false; // want_talk: no re-push (parent decision 05/11/2026)
  if (s.seen_at || s.escalated_at) return false;
  const age = now.getTime() - Date.parse(s.created_at);
  return age >= ESCALATE_AFTER_MINUTES * 60_000 && age <= ESCALATE_WINDOW_HOURS * 3600_000;
}

/**
 * Who gets the reminder. A signal for both parents → every parent device. A signal the child
 * sent to ONE parent → that parent again only: the child chose who to tell (BINH_YEN §6).
 * (needs_care, S-BY2: always every parent, R3.3.)
 */
export function escalationTarget(s: Pick<SignalRow, "kind" | "to_parent_id">): { all: true } | { all: false; parentId: string } {
  if (s.kind === "needs_care" || !s.to_parent_id) return { all: true };
  return { all: false, parentId: s.to_parent_id };
}

export type TalkPhase = "sent" | "seen" | "unseen_long";

export interface TalkStatus {
  phase: TalkPhase;
  /** What the child reads (Vietnamese). */
  text: string;
  createdAt: string;
}

/** Status of the child's latest signal, or null when there is none worth showing any more. */
export function talkStatus(s: SignalRow | null, now: Date): TalkStatus | null {
  if (!s) return null;
  const age = now.getTime() - Date.parse(s.created_at);
  if (age > STATUS_SHOW_HOURS * 3600_000 || age < -60_000) return null;
  if (s.seen_at) return { phase: "seen", text: `Bố/mẹ đã thấy lúc ${vnTime(s.seen_at)}. Bố/mẹ sẽ tìm con.`, createdAt: s.created_at };
  if (age >= ESCALATE_AFTER_MINUTES * 60_000) {
    return { phase: "unseen_long", text: "Bố mẹ chưa thấy tin. Con tìm bố mẹ trực tiếp để nói chuyện nhé.", createdAt: s.created_at };
  }
  return { phase: "sent", text: `Đã gửi lúc ${vnTime(s.created_at)}. Đợi bố mẹ thấy nhé.`, createdAt: s.created_at };
}

/** Shown right after sending when no phone accepted the push (R3: never fail silently). */
export const NOT_DELIVERED_TEXT = "Chưa báo được tới điện thoại của bố mẹ. Con tìm bố mẹ trực tiếp để nói chuyện nhé.";
/** Shown when the request itself did not reach the server. */
export const OFFLINE_TEXT = "Chưa gửi được (mất mạng?). Con tìm bố mẹ trực tiếp để nói chuyện nhé.";
