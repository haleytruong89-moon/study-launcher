import "server-only";
import { cookies } from "next/headers";
import { hashToken, newDeviceToken } from "@/lib/ext/secrets";
import { deviceToken } from "@/lib/pin/device";
import { createAdminClient } from "@/lib/supabase/admin";
import { readToday, type ChildContext } from "@/lib/today/service";
import { sessionVerdict, type SessionRow } from "./rules";
import { isStudyTime, studyCap } from "./studyCap";

/**
 * Góc bình yên sessions (BINH_YEN.md §3, R6). The SERVER holds them: a random token in an
 * httpOnly + Secure + SameSite=Strict cookie, only its SHA-256 in `by_sessions`. The idle
 * lock uses the server clock (`last_seen_at`), never the child's laptop clock.
 *
 * D5: nothing here writes audit_log or logs a value; errors carry only a short code.
 */

/** One cookie per path (a cookie has one path; same token in both). Session cookies: gone when the browser closes. */
const COOKIES = [
  { name: "sl_by_page", path: "/binh-yen" },
  { name: "sl_by_api", path: "/api/by" },
] as const;
type CookieName = (typeof COOKIES)[number]["name"];

const TOKEN_RE = /^[A-Za-z0-9_-]{40,60}$/;

export interface BySettings {
  enabled: boolean;
  idleMinutes: number;
  studyMinutes: number;
}

/** Family switch + limits. Before migration 0008 (preview without it) the corner is simply off. */
export async function bySettings(familyId: string): Promise<BySettings> {
  const { data, error } = await createAdminClient()
    .from("family_settings")
    .select("by_enabled, by_idle_lock_minutes, by_study_minutes")
    .eq("family_id", familyId)
    .maybeSingle();
  if (error || !data) return { enabled: false, idleMinutes: 5, studyMinutes: 10 };
  return {
    enabled: data.by_enabled === true,
    idleMinutes: typeof data.by_idle_lock_minutes === "number" ? data.by_idle_lock_minutes : 5,
    studyMinutes: typeof data.by_study_minutes === "number" ? data.by_study_minutes : 10,
  };
}

export interface PinInfo {
  hasPin: boolean;
  lockedUntil: string | null;
  resetAt: string | null;
}

export async function pinInfo(childId: string, now: Date): Promise<PinInfo> {
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("by_pin_hash, by_pin_locked_until, by_pin_reset_at")
    .eq("id", childId)
    .eq("role", "child")
    .maybeSingle();
  if (error || !data) return { hasPin: false, lockedUntil: null, resetAt: null };
  const locked = data.by_pin_locked_until as string | null;
  return {
    hasPin: !!data.by_pin_hash,
    lockedUntil: locked && Date.parse(locked) > now.getTime() ? locked : null,
    resetAt: (data.by_pin_reset_at as string | null) ?? null,
  };
}

/** The session token this request carries (page cookie on /binh-yen, API cookie on /api/by). */
export async function byToken(which: "page" | "api"): Promise<string | null> {
  const name: CookieName = which === "page" ? "sl_by_page" : "sl_by_api";
  const v = (await cookies()).get(name)?.value;
  return v && TOKEN_RE.test(v) ? v : null;
}

export interface ByState {
  enabled: boolean;
  hasPin: boolean;
  /** A valid Góc bình yên session (PIN entered, not idle, not wiped). */
  unlocked: boolean;
  /** Set while 5 wrong tries keep the PIN locked. */
  lockedUntil: string | null;
  /** Last time a parent wiped the PIN (the browser wipes its vault once per value). */
  resetAt: string | null;
  idleMinutes: number;
  studyMinutes: number;
  /** R5: while the corner is open in study time, when this visit ends (server clock). */
  study: { minutes: number; endsAt: string } | null;
  /** R5: this request found the visit at its study-time limit and ended the session. */
  capped: boolean;
  serverNow: string;
}

/**
 * R5: is it study time for this child right now? computeDayState (server clock) decides.
 * If the day cannot be read, the limit applies (fail-closed: when unsure, back to study).
 */
async function studyTimeNow(ctx: ChildContext, now: Date): Promise<boolean> {
  try {
    const { state } = await readToday(ctx, now);
    return isStudyTime(state);
  } catch {
    return true;
  }
}

/**
 * Current state for the child. `touch`: this request is the child's activity, so a still
 * open session gets `last_seen_at = now`. A closed (idle / wiped) session is ended for good.
 */
export async function byState(ctx: ChildContext, which: "page" | "api", touch: boolean, now = new Date()): Promise<ByState> {
  const [settings, pin] = await Promise.all([bySettings(ctx.familyId), pinInfo(ctx.childId, now)]);
  let unlocked = false;
  let capped = false;
  let study: ByState["study"] = null;
  const token = await byToken(which);
  if (settings.enabled && pin.hasPin && token) {
    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("by_sessions")
      .select("id, started_at, last_seen_at, ended_at")
      .eq("token_hash", hashToken(token))
      .eq("child_id", ctx.childId)
      .maybeSingle();
    if (error) throw new Error("by_sessions read");
    const verdict = sessionVerdict((row as SessionRow | null) ?? null, now, settings.idleMinutes, pin.resetAt);
    if (row && (verdict === "idle" || verdict === "wiped")) {
      await admin.from("by_sessions").update({ ended_at: now.toISOString() }).eq("id", row.id).is("ended_at", null);
    } else if (row && verdict === "open") {
      // R5: in study time each visit lasts at most by_study_minutes from the PIN (server clock).
      const cap = studyCap(await studyTimeNow(ctx, now), row.started_at as string, settings.studyMinutes, now);
      if (cap.capped) {
        capped = true;
        await admin.from("by_sessions").update({ ended_at: now.toISOString() }).eq("id", row.id).is("ended_at", null);
      } else {
        unlocked = true;
        study = cap.endsAt ? { minutes: cap.minutes, endsAt: cap.endsAt } : null;
        if (touch) await admin.from("by_sessions").update({ last_seen_at: now.toISOString() }).eq("id", row.id).is("ended_at", null);
      }
    }
  }
  return {
    enabled: settings.enabled,
    hasPin: pin.hasPin,
    unlocked,
    lockedUntil: pin.lockedUntil,
    resetAt: pin.resetAt,
    idleMinutes: settings.idleMinutes,
    studyMinutes: settings.studyMinutes,
    study,
    capped,
    serverNow: now.toISOString(),
  };
}

/** After a right PIN (or a new one): a new server session + the two cookies. Route handlers only. */
export async function startBySession(ctx: ChildContext, now = new Date()): Promise<void> {
  const admin = createAdminClient();
  const store = await cookies();
  // The remembered PIN browser, when this is one (lets a later slice treat shared iPads apart).
  let deviceId: string | null = null;
  const dev = await deviceToken();
  if (dev) {
    const { data } = await admin.from("pin_devices").select("id").eq("token_hash", hashToken(dev)).eq("child_id", ctx.childId).is("revoked_at", null).maybeSingle();
    deviceId = (data?.id as string | undefined) ?? null;
  }
  // One open session per child per browser: end the one this browser had.
  const old = await byToken("api");
  if (old) await admin.from("by_sessions").update({ ended_at: now.toISOString() }).eq("token_hash", hashToken(old)).is("ended_at", null);
  const token = newDeviceToken();
  const { error } = await admin.from("by_sessions").insert({
    family_id: ctx.familyId,
    child_id: ctx.childId,
    token_hash: hashToken(token),
    device_id: deviceId,
    started_at: now.toISOString(),
    last_seen_at: now.toISOString(),
  });
  if (error) throw new Error("by_sessions insert");
  for (const c of COOKIES) store.set(c.name, token, { httpOnly: true, secure: true, sameSite: "strict", path: c.path });
}

/** "Khóa lại" (or the screen's own idle timer): ends the session and removes the cookies. */
export async function endBySession(ctx: ChildContext, now = new Date()): Promise<void> {
  const store = await cookies();
  const token = await byToken("api");
  if (token) {
    await createAdminClient().from("by_sessions").update({ ended_at: now.toISOString() }).eq("token_hash", hashToken(token)).eq("child_id", ctx.childId).is("ended_at", null);
  }
  for (const c of COOKIES) store.set(c.name, "", { httpOnly: true, secure: true, sameSite: "strict", path: c.path, maxAge: 0 });
}

/** Parent wiped the PIN: every open session of the child ends. */
export async function endAllBySessions(childId: string, now = new Date()): Promise<void> {
  const { error } = await createAdminClient().from("by_sessions").update({ ended_at: now.toISOString() }).eq("child_id", childId).is("ended_at", null);
  if (error) throw new Error("by_sessions end");
}
