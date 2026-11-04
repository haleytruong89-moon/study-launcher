import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  byFolder,
  childFolders,
  cutoffDate,
  expiredDateFolders,
  expiredHomeworkPaths,
  expiredProofFiles,
  isExpiredObject,
  objectSize,
  retentionDays,
  type HomeworkRow,
  type StoredObject,
} from "./rules";

export interface PlannedFile {
  path: string;
  size: number;
}

/** What the cleanup would delete for one family (never includes database rows). */
export interface FamilyPlan {
  retentionDays: number;
  /** First local date kept; files dated before it are deleted. */
  cutoff: string;
  proofs: PlannedFile[];
  homework: PlannedFile[];
  /** true when more expired files exist than `budget` allowed (they wait for the next run). */
  more: boolean;
}

const PAGE = 1000;
const MAX_PAGES = 50;
const REMOVE_BATCH = 100;

/** Every entry of one storage folder (files and sub-folders), page by page. */
async function listAll(db: SupabaseClient, bucket: string, folder: string): Promise<StoredObject[]> {
  const out: StoredObject[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await db.storage.from(bucket).list(folder, { limit: PAGE, offset: page * PAGE, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`cleanup: list ${bucket} failed: ${error.message}`);
    const rows = (data ?? []) as StoredObject[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
  throw new Error(`cleanup: ${bucket} folder too large to list`);
}

const folderNames = (entries: StoredObject[]) => entries.filter((e) => !e.id).map((e) => e.name);

async function homeworkRows(db: SupabaseClient, familyId: string): Promise<HomeworkRow[]> {
  const out: HomeworkRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await db
      .from("homework_items")
      .select("id, child_id, due_date, created_at, done_at, archived_at, photo_paths")
      .eq("family_id", familyId)
      .order("id")
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(`cleanup: homework_items: ${error.message}`);
    const rows = (data ?? []) as HomeworkRow[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
  throw new Error("cleanup: too many homework items");
}

/**
 * Finds (does NOT delete) the expired files of one family, at most `budget` of them.
 * `db` is either the parent's own session (preview: RLS limits it to their family) or the
 * service-role client (weekly job). Returns null when the family has no usable setting,
 * in which case nothing may be deleted. Any read error throws (= delete nothing).
 */
export async function planFamily(db: SupabaseClient, familyId: string, now: Date, budget: number): Promise<FamilyPlan | null> {
  const { data: settings, error } = await db.from("family_settings").select("photo_retention_days").eq("family_id", familyId).maybeSingle();
  if (error) throw new Error(`cleanup: family_settings: ${error.message}`);
  const days = retentionDays(settings?.photo_retention_days);
  if (days === null) return null;
  const cutoff = cutoffDate(now, days);
  const plan: FamilyPlan = { retentionDays: days, cutoff, proofs: [], homework: [], more: false };
  const room = () => budget - plan.proofs.length - plan.homework.length;

  // 1. Proof photos: proofs/{family}/{child}/{local_date}/{uuid}.jpg, oldest date folders first.
  outer: for (const child of childFolders(folderNames(await listAll(db, "proofs", familyId)))) {
    const childPath = `${familyId}/${child}`;
    for (const date of expiredDateFolders(folderNames(await listAll(db, "proofs", childPath)), cutoff)) {
      const folder = `${childPath}/${date}`;
      for (const o of expiredProofFiles(date, await listAll(db, "proofs", folder), cutoff)) {
        if (room() <= 0) {
          plan.more = true;
          break outer;
        }
        plan.proofs.push({ path: `${folder}/${o.name}`, size: objectSize(o) });
      }
    }
  }

  // 2. Homework files of items archived / done long ago (never active homework).
  const paths = expiredHomeworkPaths(await homeworkRows(db, familyId), familyId, cutoff);
  outer2: for (const [folder, names] of byFolder(paths)) {
    if (room() <= 0) {
      plan.more = true;
      break;
    }
    const found = new Map((await listAll(db, "homework", folder)).map((o) => [o.name, o]));
    for (const name of names) {
      const o = found.get(name);
      if (!o || !isExpiredObject(o, cutoff)) continue; // already gone, or too new: keep
      if (room() <= 0) {
        plan.more = true;
        break outer2;
      }
      plan.homework.push({ path: `${folder}/${name}`, size: objectSize(o) });
    }
  }
  return plan;
}

/** Deletes the given files from one bucket; returns how many storage reports as removed. */
export async function removeFiles(db: SupabaseClient, bucket: "proofs" | "homework", files: PlannedFile[]): Promise<number> {
  let removed = 0;
  for (let i = 0; i < files.length; i += REMOVE_BATCH) {
    const batch = files.slice(i, i + REMOVE_BATCH).map((f) => f.path);
    const { data, error } = await db.storage.from(bucket).remove(batch);
    if (error) throw new Error(`cleanup: remove from ${bucket} failed after ${removed} files: ${error.message}`);
    removed += (data ?? []).length;
  }
  return removed;
}

export const planBytes = (p: FamilyPlan) => [...p.proofs, ...p.homework].reduce((sum, f) => sum + f.size, 0);
