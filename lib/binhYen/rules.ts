/**
 * Góc bình yên — S-BY0 rules (docs/BINH_YEN.md R3, R6, §4, §6). PURE: no I/O, no clock of its
 * own (every function takes `now` from the SERVER), so tests pin the exact behaviour and the
 * Vietnamese wording. Safe in browser and server code.
 */
import { pinProblem } from "@/lib/pin/rules";
import { vnTime } from "@/lib/today/view";
import { localDate } from "@/lib/time";

/** httpOnly cookie holding the Góc bình yên session token (only its SHA-256 is stored). */
export const BY_SESSION_COOKIE = "sl_by";
/** The cookie is sent only to these paths (one cookie per path, same token). */
export const BY_COOKIE_PATHS = ["/binh-yen", "/api/by"] as const;

export const BY_PIN_MAX_TRIES = 5;
export const BY_PIN_LOCK_MINUTES = 15;

/** "Con muốn nói chuyện": at most one per child (per kind) every 2 minutes. */
export const TALK_GAP_SECONDS = 120;
/** Not seen after 10 minutes → re-push once + the child is told to find a parent / call 111 (Q5). */
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
// PIN (R6)
// ---------------------------------------------------------------------------

/** Why a new Góc bình yên PIN is not accepted, or null. `sameAsLogin`: the server compared it with the login PIN. */
export function byPinProblem(pin: string, again: string, sameAsLogin: boolean): string | null {
  const basic = pinProblem(pin);
  if (basic) return basic;
  if (pin !== again) return "Hai lần gõ chưa giống nhau. Gõ lại nhé.";
  if (sameAsLogin) return "PIN này giống PIN đăng nhập (bố mẹ biết PIN đó). Chọn số khác để chỉ mình con biết.";
  return null;
}

export function byWrongPinMessage(tryNumber: number): string {
  const left = BY_PIN_MAX_TRIES - tryNumber;
  return left > 0 ? `PIN chưa đúng. Còn ${left} lần thử.` : `Sai ${BY_PIN_MAX_TRIES} lần. Đợi ${BY_PIN_LOCK_MINUTES} phút rồi thử lại.`;
}

export function byLockedMessage(lockedUntil: string): string {
  return `Góc bình yên đang khóa vì gõ sai nhiều lần. Thử lại sau ${vnTime(lockedUntil)}.`;
}

/** "PIN Góc bình yên vừa được bố mẹ xóa lúc 19:05 ngày 05/11." */
export function pinWipedNotice(resetAt: string): string {
  const d = localDate(new Date(resetAt));
  return `PIN Góc bình yên vừa được bố mẹ xóa lúc ${vnTime(resetAt)} ngày ${d.slice(8, 10)}/${d.slice(5, 7)}. Những gì con viết trên máy này cũng đã được xóa. Con đặt PIN mới để vào lại.`;
}

// ---------------------------------------------------------------------------
// Session (R6: idle lock on the SERVER clock)
// ---------------------------------------------------------------------------

export interface SessionRow {
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
}

export type SessionVerdict = "open" | "idle" | "ended" | "wiped" | "none";

/**
 * Whether a Góc bình yên session still opens the corner at `now` (server time).
 * - ended (locked by hand, or a parent wiped the PIN) → closed
 * - PIN wiped (or set again) after the session started → closed
 * - no request for longer than `idleMinutes` → closed ("idle")
 */
export function sessionVerdict(row: SessionRow | null, now: Date, idleMinutes: number, pinResetAt: string | null): SessionVerdict {
  if (!row) return "none";
  if (row.ended_at) return "ended";
  if (pinResetAt && Date.parse(pinResetAt) >= Date.parse(row.started_at)) return "wiped";
  if (now.getTime() - Date.parse(row.last_seen_at) > idleMinutes * 60_000) return "idle";
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

/** Unseen, never escalated, older than 10 minutes but younger than the window → re-push once. */
export function shouldEscalate(s: Pick<SignalRow, "created_at" | "seen_at" | "escalated_at">, now: Date): boolean {
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
    return { phase: "unseen_long", text: `Chưa ai thấy. Con hãy tìm bố mẹ trực tiếp hoặc ${HOTLINE_TEXT}.`, createdAt: s.created_at };
  }
  return { phase: "sent", text: `Đã gửi lúc ${vnTime(s.created_at)}. Đợi bố mẹ thấy nhé.`, createdAt: s.created_at };
}

/** Shown right after sending when no phone accepted the push (R3: never fail silently). */
export const NOT_DELIVERED_TEXT = `Chưa báo được tới điện thoại của bố mẹ. Con hãy tìm bố mẹ trực tiếp hoặc ${HOTLINE_TEXT}.`;
/** Shown when the request itself did not reach the server. */
export const OFFLINE_TEXT = `Chưa gửi được (mất mạng?). Con hãy tìm bố mẹ trực tiếp hoặc ${HOTLINE_TEXT}.`;
