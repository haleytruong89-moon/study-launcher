/**
 * S3e "tự xóa ảnh quá hạn": which stored FILES are old enough to delete. Pure (no I/O), so
 * the weekly job (/api/cron/cleanup) and the parent's preview (/api/admin/photo-cleanup)
 * decide exactly the same way, and the boundaries are unit-tested.
 *
 * Only files in storage are ever deleted; database rows (homework, runs, verdicts) stay.
 * "Older than N days" is counted in family days (Asia/Ho_Chi_Minh): a file from local date D
 * is expired when D < today − N. A file exactly N days old is KEPT.
 * Every check is conservative: anything unknown, malformed or too new is kept.
 */

import { isHomeworkFilePath } from "@/lib/files";
import { addDays, localDate } from "@/lib/time";

/** family_settings.photo_retention_days default (DESIGN §9). */
export const DEFAULT_RETENTION_DAYS = 120;
/** Safety floor: even if the setting is lower (the DB allows 1), never delete files younger than this. */
export const MIN_RETENTION_DAYS = 7;
/** Hard cap of files deleted in one run (both buckets together); the rest waits for next week. */
export const MAX_FILES_PER_RUN = 500;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PROOF_FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Effective retention from the stored setting; null (= delete nothing) when it is not a sane number. */
export function retentionDays(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) return null;
  return Math.max(value, MIN_RETENTION_DAYS);
}

/** First local date that is KEPT: files dated strictly before it are expired. */
export function cutoffDate(now: Date, retention: number): string {
  return addDays(localDate(now), -retention);
}

/** A local date (YYYY-MM-DD) strictly before the cutoff. Malformed = not expired. */
export function isExpiredDate(date: string | null | undefined, cutoff: string): boolean {
  return typeof date === "string" && DATE_RE.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && date < cutoff;
}

/** An instant whose family-local date is strictly before the cutoff. Missing/malformed = not expired. */
export function isExpiredInstant(iso: string | null | undefined, cutoff: string): boolean {
  if (typeof iso !== "string" || iso === "") return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return localDate(new Date(t)) < cutoff;
}

/** Storage object metadata as returned by `storage.from(bucket).list()`. */
export interface StoredObject {
  name: string;
  /** null for a folder */
  id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: { size?: number } | null;
}

/** The object itself must be old: created (and, if set, last updated) before the cutoff. */
export function isExpiredObject(o: StoredObject, cutoff: string): boolean {
  if (!o.id) return false; // a folder, not a file
  if (!isExpiredInstant(o.created_at, cutoff)) return false;
  return o.updated_at == null || isExpiredInstant(o.updated_at, cutoff);
}

export function objectSize(o: StoredObject): number {
  const s = o.metadata?.size;
  return typeof s === "number" && Number.isFinite(s) && s > 0 ? s : 0;
}

/** Child folders under proofs/{family}/ worth scanning (names must be UUIDs). */
export function childFolders(names: string[]): string[] {
  return names.filter((n) => UUID_RE.test(n)).sort();
}

/** Date folders under proofs/{family}/{child}/ that are entirely older than the cutoff, oldest first. */
export function expiredDateFolders(names: string[], cutoff: string): string[] {
  return names.filter((n) => isExpiredDate(n, cutoff)).sort();
}

/**
 * Proof photos to delete inside ONE expired date folder: well-formed photo names whose object
 * is itself older than the cutoff (a file put into an old folder recently is kept).
 */
export function expiredProofFiles(folderDate: string, objects: StoredObject[], cutoff: string): StoredObject[] {
  if (!isExpiredDate(folderDate, cutoff)) return [];
  return objects.filter((o) => PROOF_FILE_RE.test(o.name) && isExpiredObject(o, cutoff)).sort((a, b) => a.name.localeCompare(b.name));
}

export interface HomeworkRow {
  id: string;
  child_id: string;
  due_date: string;
  created_at: string | null;
  done_at: string | null;
  archived_at: string | null;
  photo_paths: string[] | null;
}

/**
 * A homework item whose files may go: it was archived ("Gỡ bài") or finished more than N
 * days ago, AND it was created and due more than N days ago. Active (not done, not archived)
 * homework is never touched, however old.
 */
export function isExpiredHomework(h: HomeworkRow, cutoff: string): boolean {
  if (h.archived_at == null && h.done_at == null) return false;
  // Every mark that is set must be old: archived or done recently = keep.
  if (h.archived_at != null && !isExpiredInstant(h.archived_at, cutoff)) return false;
  if (h.done_at != null && !isExpiredInstant(h.done_at, cutoff)) return false;
  return isExpiredInstant(h.created_at, cutoff) && isExpiredDate(h.due_date, cutoff);
}

/**
 * Homework file paths to delete for one family: files of expired items that sit in this
 * family's + child's folder, minus any path still listed on an item that is NOT expired.
 * Sorted, unique. The caller still checks each object's own age in storage.
 */
export function expiredHomeworkPaths(rows: HomeworkRow[], familyId: string, cutoff: string): string[] {
  const keep = new Set<string>();
  const candidates = new Set<string>();
  for (const h of rows) {
    const paths = h.photo_paths ?? [];
    if (isExpiredHomework(h, cutoff)) {
      for (const p of paths) if (isHomeworkFilePath(p, familyId, h.child_id)) candidates.add(p);
    } else {
      for (const p of paths) keep.add(p);
    }
  }
  return [...candidates].filter((p) => !keep.has(p)).sort();
}

/** Groups "a/b/c/file" paths by folder ("a/b/c" → file names), for one list() per folder. */
export function byFolder(paths: string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const p of paths) {
    const slash = p.lastIndexOf("/");
    if (slash <= 0) continue;
    const folder = p.slice(0, slash);
    const list = out.get(folder) ?? [];
    list.push(p.slice(slash + 1));
    out.set(folder, list);
  }
  return out;
}

/** "ảnh đã xóa" note for a screen: true when files of `date` are past the family's retention. */
export function photosExpiredOn(date: string, now: Date, setting: unknown): boolean {
  const days = retentionDays(setting);
  return days !== null && isExpiredDate(date, cutoffDate(now, days));
}
