/**
 * Sổ tay thám tử (R7c): the Hồ sơ mật cards Nguyên chose to keep, remembered in THIS browser
 * only. Nothing goes to the server, logs or parents. Broken or missing storage = an empty
 * notebook; every access is wrapped in try/catch and must be read after mount.
 *
 * Storage:
 * - `dossier-notebook`: JSON array of { date: "YYYY-MM-DD", key }, newest first, one entry per
 *   key, at most 200. Unknown or held keys are ignored.
 * - `dossier-topic`: the last topic chip picked on this device.
 */
import { findShownDossier, isDossierTopic, type DossierTopic } from "./dossier";

export const NOTEBOOK_KEY = "dossier-notebook";
export const TOPIC_KEY = "dossier-topic";
/** Window event fired after a card is saved (the notebook column listens to it). */
export const NOTEBOOK_EVENT = "dossier:saved";
export const NOTEBOOK_CAP = 200;

export interface NotebookEntry {
  date: string;
  key: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function win(): (Window & typeof globalThis) | undefined {
  return (globalThis as { window?: Window & typeof globalThis }).window;
}

function storage(): Storage | undefined {
  try {
    return win()?.localStorage;
  } catch {
    return undefined;
  }
}

/** Clean entries from raw JSON: valid shape, known (not held) keys, first entry per key wins, capped. */
export function parseNotebook(raw: string | null): NotebookEntry[] {
  try {
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(v)) return [];
    const seen = new Set<string>();
    const out: NotebookEntry[] = [];
    for (const e of v) {
      if (!e || typeof e !== "object") continue;
      const { date, key } = e as { date?: unknown; key?: unknown };
      if (typeof date !== "string" || !DATE.test(date) || typeof key !== "string") continue;
      if (seen.has(key) || !findShownDossier(key)) continue;
      seen.add(key);
      out.push({ date, key });
      if (out.length >= NOTEBOOK_CAP) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Saved cards, newest first. Never throws. */
export function readNotebook(): NotebookEntry[] {
  try {
    return parseNotebook(storage()?.getItem(NOTEBOOK_KEY) ?? null);
  } catch {
    return [];
  }
}

export function isInNotebook(key: string): boolean {
  return readNotebook().some((e) => e.key === key);
}

/**
 * Keep a card (moved to the top if it was already kept). Unknown / held keys and bad dates are
 * ignored. Returns the notebook after the change. Fires `dossier:saved` on success.
 */
export function addToNotebook(date: string, key: string): NotebookEntry[] {
  const before = readNotebook();
  if (!DATE.test(date) || !findShownDossier(key)) return before;
  const st = storage();
  if (!st) return before;
  const next = [{ date, key }, ...before.filter((e) => e.key !== key)].slice(0, NOTEBOOK_CAP);
  try {
    st.setItem(NOTEBOOK_KEY, JSON.stringify(next));
  } catch {
    return before;
  }
  try {
    const w = win();
    if (w && typeof w.dispatchEvent === "function") w.dispatchEvent(new Event(NOTEBOOK_EVENT));
  } catch {
    /* no listener: fine */
  }
  return next;
}

/** The last topic picked on this device, or null. */
export function readTopic(): DossierTopic | null {
  try {
    const v = storage()?.getItem(TOPIC_KEY) ?? null;
    return isDossierTopic(v) ? v : null;
  } catch {
    return null;
  }
}

export function writeTopic(t: DossierTopic): void {
  if (!isDossierTopic(t)) return;
  try {
    storage()?.setItem(TOPIC_KEY, t);
  } catch {
    /* not remembered: fine */
  }
}
