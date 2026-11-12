/**
 * "Giữ sổ tay" (Đợt 4, 12/11/2026): a child's notebook (lib/binhYen/notebook.ts) saved to a file
 * on her own device and loaded back, e.g. after clearing the browser or on another device.
 * No server: the file goes from the browser to the device's Downloads and back.
 *
 * The file holds ONLY which cards were kept and when, the notebook kind and a version: no card
 * text, no feelings. The text always comes from the app, so a shared file reveals nothing but
 * card ids. Pure functions here; the page does the Blob download and the file picker.
 *
 * Loading never deletes: the file is merged into what is already on this device (union of
 * keys, the earliest saved date wins). Anything that is not exactly this notebook's file is
 * rejected as a whole; card ids this app does not show (unknown or held) are skipped and counted.
 */
import { z } from "zod";
import { NOTEBOOK_CAP, type NotebookEntry } from "./notebook";

/** Which notebook a file belongs to: Nguyên's Hồ sơ mật ("dossier") or An's Sổ tay nhà khoa học ("field"). */
export type NotebookKind = "dossier" | "field";

export const NOTEBOOK_FILE_VERSION = 1;
/** Far above a full notebook (200 entries ≈ 10 KB); anything bigger is not ours. */
export const NOTEBOOK_FILE_MAX_BYTES = 200_000;
/** More rows than this cannot come from a real notebook (cap 200); the size limit also bounds it. */
const MAX_PAGES = 2_000;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KEY = /^[a-z0-9_-]{1,80}$/;

const fileSchema = z
  .object({
    version: z.literal(NOTEBOOK_FILE_VERSION),
    kind: z.enum(["dossier", "field"]),
    pages: z
      .array(
        z
          .object({
            key: z.string().regex(KEY),
            date: z.string().regex(DATE),
          })
          .strict(),
      )
      .max(MAX_PAGES),
  })
  .strict();

export type NotebookFile = z.infer<typeof fileSchema>;

/** `so-tay-YYYY-MM-DD.json` for the given local date. */
export function notebookFileName(date: string): string {
  return `so-tay-${DATE.test(date) ? date : "sao-luu"}.json`;
}

/** The file's text: kind, version, and the kept card ids with their dates (newest first). */
export function serializeNotebook(kind: NotebookKind, entries: readonly NotebookEntry[]): string {
  const file: NotebookFile = { version: NOTEBOOK_FILE_VERSION, kind, pages: entries.map((e) => ({ key: e.key, date: e.date })) };
  return JSON.stringify(file, null, 1);
}

export type ParsedNotebookFile =
  | { ok: true; pages: NotebookEntry[]; skipped: number }
  | { ok: false; reason: "too_big" | "not_json" | "bad_shape" | "wrong_kind" };

function byteLength(text: string): number {
  try {
    return new TextEncoder().encode(text).length;
  } catch {
    return text.length * 3;
  }
}

/**
 * Read a file's text (JSON.parse only, never eval). Accepted only if it is exactly this
 * notebook's file: right version, right kind, every row a valid { key, date }. Card ids
 * `isShown` does not know are skipped and counted; a key listed twice keeps its earliest date.
 */
export function parseNotebookFile(text: string, kind: NotebookKind, isShown: (key: string) => unknown): ParsedNotebookFile {
  if (typeof text !== "string" || byteLength(text) > NOTEBOOK_FILE_MAX_BYTES) return { ok: false, reason: "too_big" };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "not_json" };
  }
  const r = fileSchema.safeParse(raw);
  if (!r.success) return { ok: false, reason: "bad_shape" };
  if (r.data.kind !== kind) return { ok: false, reason: "wrong_kind" };
  let skipped = 0;
  const byKey = new Map<string, NotebookEntry>();
  for (const p of r.data.pages) {
    if (!isShown(p.key)) {
      skipped++;
      continue;
    }
    const had = byKey.get(p.key);
    if (!had) byKey.set(p.key, { key: p.key, date: p.date });
    else if (p.date < had.date) had.date = p.date;
  }
  return { ok: true, pages: [...byKey.values()], skipped };
}

/**
 * Merge loaded pages into the current notebook without losing anything: every key of both,
 * each with its earliest date, newest first (ties keep the current order, then the file's),
 * at most NOTEBOOK_CAP. `added` = keys that were not on this device before.
 */
export function mergeNotebook(current: readonly NotebookEntry[], incoming: readonly NotebookEntry[]): { entries: NotebookEntry[]; added: number } {
  const byKey = new Map<string, NotebookEntry>();
  for (const e of [...current, ...incoming]) {
    const had = byKey.get(e.key);
    if (!had) byKey.set(e.key, { key: e.key, date: e.date });
    else if (e.date < had.date) had.date = e.date;
  }
  // Array.prototype.sort is stable, so equal dates keep insertion order.
  const entries = [...byKey.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, NOTEBOOK_CAP);
  const before = new Set(current.map((e) => e.key));
  return { entries, added: entries.filter((e) => !before.has(e.key)).length };
}
