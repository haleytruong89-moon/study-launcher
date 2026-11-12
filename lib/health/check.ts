/**
 * C2 daily self-check (parent decision 12/11/2026): "the app tells the parent when something is
 * broken". PURE: the cron route (app/api/cron/health) reads the rows, this decides what to report
 * and words ONE calm push per family — or nothing when all is well. No I/O, no clock (now is passed).
 *
 * Laptop check (DESIGN §7 S6 says a laptop that is simply off must not alarm anyone): a paired,
 * not revoked laptop is reported only when it has not asked the server for more than 48 hours
 * AND its child started some work (a task run) in those same 48 hours — the child was studying,
 * so the laptop should have been on. A child who only used the phone / iPad for 2 days can still
 * trigger it; the words say "có thể", never that something is certainly wrong.
 */
import type { PushMessage } from "@/lib/push/messages";

export const DEVICE_SILENT_HOURS = 48;

export interface DeviceRow {
  id: string;
  family_id: string;
  child_id: string;
  label: string | null;
  last_seen_at: string | null;
  created_at: string;
}

export interface DeviceProblem {
  kind: "device_silent";
  familyId: string;
  deviceId: string;
  childName: string;
  /** Last poll, or the pairing time when it never polled. */
  since: string;
  neverSeen: boolean;
}

/** "dd/mm HH:MM" in Vietnam time. */
export function vnDateTime(iso: string): string {
  const d = new Date(Date.parse(iso) + 7 * 3600_000).toISOString();
  return `${d.slice(8, 10)}/${d.slice(5, 7)} ${d.slice(11, 16)}`;
}

/**
 * Laptops to report. `workStartedAt` = started_at of the children's task runs (any order, any
 * child of the family); `names` = child id -> display name.
 */
export function silentDevices(
  devices: readonly DeviceRow[],
  runs: readonly { child_id: string; started_at: string | null }[],
  names: ReadonlyMap<string, string>,
  now: Date,
): DeviceProblem[] {
  const cutoff = now.getTime() - DEVICE_SILENT_HOURS * 3600_000;
  const worked = new Set(runs.filter((r) => r.started_at !== null && Date.parse(r.started_at) >= cutoff && Date.parse(r.started_at) <= now.getTime()).map((r) => r.child_id));
  // A re-paired laptop leaves its old row behind (nothing revokes it): a child with another
  // device seen in the window is fine, so the old row never raises a daily false alarm.
  const seenRecently = new Set(devices.filter((d) => d.last_seen_at !== null && Date.parse(d.last_seen_at) >= cutoff).map((d) => d.child_id));
  const out: DeviceProblem[] = [];
  for (const d of devices) {
    const since = d.last_seen_at ?? d.created_at;
    const sinceMs = Date.parse(since);
    if (!Number.isFinite(sinceMs) || sinceMs >= cutoff || !worked.has(d.child_id) || seenRecently.has(d.child_id)) continue;
    out.push({ kind: "device_silent", familyId: d.family_id, deviceId: d.id, childName: names.get(d.child_id) ?? "con", since, neverSeen: d.last_seen_at === null });
  }
  return out;
}

/** One line per problem, in the parent's words. */
export function problemText(p: DeviceProblem): string {
  return p.neverSeen
    ? `Laptop của ${p.childName} chưa báo về lần nào từ khi ghép (${vnDateTime(p.since)}) — extension có thể bị tắt`
    : `Laptop của ${p.childName} chưa báo về từ ${vnDateTime(p.since)} — extension có thể bị tắt`;
}

/** The one push for a family, or null when nothing is wrong (silent). */
export function healthMessage(problems: readonly DeviceProblem[]): PushMessage | null {
  const first = problems[0];
  if (!first) return null;
  const more = problems.length - 1;
  return {
    title: "Study Launcher tự kiểm tra: cần bố mẹ xem",
    body: `${problemText(first)}${more > 0 ? ` · và ${more} việc khác` : ""} · chạm để xem`,
    url: "/parent/devices",
    tag: "health",
  };
}
