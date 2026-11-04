/**
 * "Báo bố mẹ khi extension bị gỡ / không chạy" (S6, 01/11/2026). Pure helpers shared by the
 * two routes and the parent's Devices page. Events live in audit_log (no new table):
 *  - "ext.uninstalled": payload { device_id, label, notified } — the browser opened the
 *    uninstall address of a paired laptop;
 *  - "ext.missing": payload { browser, notified } — the child opened /today on a desktop
 *    Chrome/Edge where the extension did not answer.
 * A laptop that is simply switched off is NEVER an alert (that is normal).
 */
import { FAMILY_TIME_ZONE, localDate } from "@/lib/time";

export const EXT_UNINSTALLED = "ext.uninstalled";
export const EXT_MISSING = "ext.missing";

/** Uninstall: at most one record + push per laptop per hour (re-opening the address is harmless). */
export const UNINSTALL_QUIET_MS = 60 * 60_000;

/** The ?k= proof: SHA-256 hex of the device token (= extension_devices.token_hash). */
export function parseProof(k: string | null | undefined): string | null {
  return k && /^[0-9a-f]{64}$/.test(k) ? k : null;
}

/** True when nothing was recorded within the quiet window before now. */
export function quietOver(lastIso: string | null | undefined, now: Date, quietMs: number): boolean {
  if (!lastIso) return true;
  const t = new Date(lastIso).getTime();
  return !Number.isFinite(t) || now.getTime() - t >= quietMs;
}

export interface AuditEventRow {
  action: string;
  actor_id: string | null;
  payload: unknown;
  created_at: string;
}

export interface LastExtEvent {
  at: string;
  /** Browser name for "ext.missing" (Edge, Chrome, …). */
  browser?: string;
}

/**
 * Latest event per laptop (uninstalled, keyed by device id) and per child (missing, keyed by
 * child id). Rows may come in any order.
 */
export function lastExtEvents(rows: AuditEventRow[]): { uninstalled: Map<string, LastExtEvent>; missing: Map<string, LastExtEvent> } {
  const uninstalled = new Map<string, LastExtEvent>();
  const missing = new Map<string, LastExtEvent>();
  const newer = (prev: LastExtEvent | undefined, at: string) => !prev || new Date(at).getTime() > new Date(prev.at).getTime();
  for (const r of rows) {
    const p = (r.payload && typeof r.payload === "object" ? r.payload : {}) as Record<string, unknown>;
    if (r.action === EXT_UNINSTALLED && typeof p.device_id === "string") {
      if (newer(uninstalled.get(p.device_id), r.created_at)) uninstalled.set(p.device_id, { at: r.created_at });
    } else if (r.action === EXT_MISSING && r.actor_id) {
      if (newer(missing.get(r.actor_id), r.created_at)) {
        missing.set(r.actor_id, { at: r.created_at, ...(typeof p.browser === "string" ? { browser: p.browser } : {}) });
      }
    }
  }
  return { uninstalled, missing };
}

const HM = new Intl.DateTimeFormat("en-GB", { timeZone: FAMILY_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });
const DM = new Intl.DateTimeFormat("en-GB", { timeZone: FAMILY_TIME_ZONE, day: "2-digit", month: "2-digit" });

/** "hôm nay 20:15", "hôm qua 07:05" or "28/10 20:15" (family time zone). */
export function whenText(iso: string, now: Date): string {
  const at = new Date(iso);
  const time = HM.format(at);
  const day = localDate(at);
  if (day === localDate(now)) return `hôm nay ${time}`;
  if (day === localDate(new Date(now.getTime() - 86_400_000))) return `hôm qua ${time}`;
  return `${DM.format(at)} ${time}`;
}
