import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Every referenced homework file must really exist in storage. Lists each folder with the
 * parent's own session (storage RLS), so only this family's files can ever be found.
 * Returns null when all exist, otherwise an error message for the parent.
 */
export async function missingHomeworkFiles(db: SupabaseClient, paths: string[]): Promise<string | null> {
  const folders = new Map<string, Set<string>>();
  for (const p of paths) {
    const slash = p.lastIndexOf("/");
    const folder = p.slice(0, slash);
    if (!folders.has(folder)) folders.set(folder, new Set());
    folders.get(folder)?.add(p.slice(slash + 1));
  }
  for (const [folder, names] of folders) {
    const { data, error } = await db.storage.from("homework").list(folder, { limit: 1000 });
    if (error) {
      console.error("homework files: list failed", error.message);
      return "Không kiểm tra được tệp, thử lại.";
    }
    const found = new Set((data ?? []).map((o) => o.name));
    for (const n of names) if (!found.has(n)) return "Tệp chưa tải lên xong, thử lại.";
  }
  return null;
}

/** Best effort: removes files the parent took off an item (nothing else references them). */
export async function removeHomeworkFiles(db: SupabaseClient, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await db.storage.from("homework").remove(paths);
  if (error) console.error("homework files: remove failed", error.message);
}
