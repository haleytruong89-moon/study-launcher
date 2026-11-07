import "server-only";
import { cookies } from "next/headers";
import { hashToken, newDeviceToken } from "@/lib/ext/secrets";
import { deviceToken } from "@/lib/pin/device";
import { createAdminClient } from "@/lib/supabase/admin";
import { readToday, type ChildContext } from "@/lib/today/service";
import { sessionVerdict, type SessionRow } from "./rules";
import { isStudyTime, studyCap } from "./studyCap";

/**
 * Góc bình yên visits (BINH_YEN.md §3, R5). Parent decision 07/11/2026: there is NO separate
 * PIN and NO idle lock any more — being logged in as the child opens the corner. The SERVER
 * still holds one visit per browser: a random token in an httpOnly + Secure + SameSite=Strict
 * cookie, only its SHA-256 in `by_sessions`. It exists for the study-time limit (R5): each
 * visit lasts at most `by_study_minutes` from its start, on the server clock.
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
  studyMinutes: number;
}

/** Family switch + limit. Before migration 0008 (preview without it) the corner is simply off. */
export async function bySettings(familyId: string): Promise<BySettings> {
  const { data, error } = await createAdminClient().from("family_settings").select("by_enabled, by_study_minutes").eq("family_id", familyId).maybeSingle();
  if (error || !data) return { enabled: false, studyMinutes: 10 };
  return {
    enabled: data.by_enabled === true,
    studyMinutes: typeof data.by_study_minutes === "number" ? data.by_study_minutes : 10,
  };
}

/** The visit token this request carries (page cookie on /binh-yen, API cookie on /api/by). */
export async function byToken(which: "page" | "api"): Promise<string | null> {
  const name: CookieName = which === "page" ? "sl_by_page" : "sl_by_api";
  const v = (await cookies()).get(name)?.value;
  return v && TOKEN_RE.test(v) ? v : null;
}

export interface ByState {
  enabled: boolean;
  /** This browser has a visit going on (within the study-time limit). */
  open: boolean;
  studyMinutes: number;
  /** R5: while the corner is open in study time, when this visit ends (server clock). */
  study: { minutes: number; endsAt: string } | null;
  /** R5: this request found the visit at its study-time limit and ended it. */
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

interface VisitRow extends SessionRow {
  id: string;
}

async function readVisit(ctx: ChildContext, token: string | null): Promise<VisitRow | null> {
  if (!token) return null;
  const { data, error } = await createAdminClient()
    .from("by_sessions")
    .select("id, started_at, last_seen_at, ended_at")
    .eq("token_hash", hashToken(token))
    .eq("child_id", ctx.childId)
    .maybeSingle();
  if (error) throw new Error("by_sessions read");
  return (data as VisitRow | null) ?? null;
}

async function endVisit(id: string, now: Date): Promise<void> {
  const { error } = await createAdminClient().from("by_sessions").update({ ended_at: now.toISOString() }).eq("id", id).is("ended_at", null);
  if (error) throw new Error("by_sessions end");
}

/**
 * State of this browser's visit. `touch`: this request is the child being in the corner, so a
 * visit still going on gets `last_seen_at = now`. A stale visit (the child left) is ended; a
 * visit at the study-time limit is ended and reported once as `capped`.
 */
export async function byState(ctx: ChildContext, which: "page" | "api", touch: boolean, now = new Date()): Promise<ByState> {
  const settings = await bySettings(ctx.familyId);
  let open = false;
  let capped = false;
  let study: ByState["study"] = null;
  if (settings.enabled) {
    const row = await readVisit(ctx, await byToken(which));
    const verdict = sessionVerdict(row, now);
    if (row && verdict === "stale") {
      await endVisit(row.id, now);
    } else if (row && verdict === "open") {
      // R5: in study time each visit lasts at most by_study_minutes from its start (server clock).
      const cap = studyCap(await studyTimeNow(ctx, now), row.started_at, settings.studyMinutes, now);
      if (cap.capped) {
        capped = true;
        await endVisit(row.id, now);
      } else {
        open = true;
        study = cap.endsAt ? { minutes: cap.minutes, endsAt: cap.endsAt } : null;
        if (touch) await createAdminClient().from("by_sessions").update({ last_seen_at: now.toISOString() }).eq("id", row.id).is("ended_at", null);
      }
    }
  }
  return { enabled: settings.enabled, open, studyMinutes: settings.studyMinutes, study, capped, serverNow: now.toISOString() };
}

/**
 * The child opens the corner (POST /api/by/open, route handlers only — they can set cookies):
 * the visit going on continues; otherwise a NEW visit starts (none yet, the child left a while
 * ago, or a re-entry after the study-time limit — Q6: coming back at once is fine). A visit
 * that has JUST reached the limit is reported as capped once instead, so the child sees why.
 */
export async function openByVisit(ctx: ChildContext, now = new Date()): Promise<ByState> {
  const state = await byState(ctx, "api", true, now);
  if (!state.enabled || state.open || state.capped) return state;
  await startBySession(ctx, now);
  // A fresh visit: the limit (if any) counts from now.
  const cap = studyCap(await studyTimeNow(ctx, now), now.toISOString(), state.studyMinutes, now);
  return { ...state, open: true, study: cap.endsAt ? { minutes: cap.minutes, endsAt: cap.endsAt } : null };
}

/** A new server visit + the two cookies. Route handlers only. */
async function startBySession(ctx: ChildContext, now: Date): Promise<void> {
  const admin = createAdminClient();
  const store = await cookies();
  // The remembered PIN-login browser, when this is one (lets a later slice treat shared iPads apart).
  let deviceId: string | null = null;
  const dev = await deviceToken();
  if (dev) {
    const { data } = await admin.from("pin_devices").select("id").eq("token_hash", hashToken(dev)).eq("child_id", ctx.childId).is("revoked_at", null).maybeSingle();
    deviceId = (data?.id as string | undefined) ?? null;
  }
  // One visit per child per browser: end the one this browser had.
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
