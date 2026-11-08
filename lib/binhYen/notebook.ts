/**
 * Notebooks of kept cards, remembered in THIS browser only (R7c, generalised in R7d). Nothing
 * goes to the server, logs or parents. Broken or missing storage = an empty notebook; every
 * access is wrapped in try/catch and must be read after mount.
 *
 * Two decks, two separate notebooks (saving in one never shows in the other):
 * - Nguyên's Sổ tay thám tử (Hồ sơ mật): `dossier-notebook`, `dossier-topic`, event `dossier:saved`.
 *   The plain exports below (NOTEBOOK_KEY, readNotebook, …) are this one, unchanged since R7c.
 * - An's Sổ tay nhà khoa học (R7d): `field-notebook`, `field-topic`, event `field-notes:saved`.
 *
 * Storage, per notebook:
 * - the notebook key: JSON array of { date: "YYYY-MM-DD", key }, newest first, one entry per
 *   key, at most 200. Unknown or held keys are ignored.
 * - the topic key: the last topic chip picked on this device.
 */
import { findShownDossier, isDossierTopic, type DossierTopic } from "./dossier";
import { findShownFieldNote, isScienceTopic, type ScienceTopic } from "./fieldNotes";

export const NOTEBOOK_CAP = 200;

export interface NotebookEntry {
  date: string;
  key: string;
}

/** What makes one notebook: where it lives, which cards it accepts, which topics it remembers. */
export interface NotebookConfig<T extends string> {
  storageKey: string;
  topicKey: string;
  /** Window event fired after a card is saved (the notebook column listens to it). */
  event: string;
  /** A card the child may see (not held), by key; anything else is ignored. */
  findShown: (key: string) => unknown;
  isTopic: (v: unknown) => v is T;
}

export interface NotebookStore<T extends string> {
  readonly storageKey: string;
  readonly topicKey: string;
  readonly event: string;
  parse(raw: string | null): NotebookEntry[];
  read(): NotebookEntry[];
  has(key: string): boolean;
  add(date: string, key: string): NotebookEntry[];
  readTopic(): T | null;
  writeTopic(t: T): void;
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

export function createNotebook<T extends string>(cfg: NotebookConfig<T>): NotebookStore<T> {
  /** Clean entries from raw JSON: valid shape, known (not held) keys, first entry per key wins, capped. */
  function parse(raw: string | null): NotebookEntry[] {
    try {
      const v = raw ? (JSON.parse(raw) as unknown) : [];
      if (!Array.isArray(v)) return [];
      const seen = new Set<string>();
      const out: NotebookEntry[] = [];
      for (const e of v) {
        if (!e || typeof e !== "object") continue;
        const { date, key } = e as { date?: unknown; key?: unknown };
        if (typeof date !== "string" || !DATE.test(date) || typeof key !== "string") continue;
        if (seen.has(key) || !cfg.findShown(key)) continue;
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
  function read(): NotebookEntry[] {
    try {
      return parse(storage()?.getItem(cfg.storageKey) ?? null);
    } catch {
      return [];
    }
  }

  /**
   * Keep a card (moved to the top if it was already kept). Unknown / held keys and bad dates are
   * ignored. Returns the notebook after the change. Fires the notebook's event on success.
   */
  function add(date: string, key: string): NotebookEntry[] {
    const before = read();
    if (!DATE.test(date) || !cfg.findShown(key)) return before;
    const st = storage();
    if (!st) return before;
    const next = [{ date, key }, ...before.filter((e) => e.key !== key)].slice(0, NOTEBOOK_CAP);
    try {
      st.setItem(cfg.storageKey, JSON.stringify(next));
    } catch {
      return before;
    }
    try {
      const w = win();
      if (w && typeof w.dispatchEvent === "function") w.dispatchEvent(new Event(cfg.event));
    } catch {
      /* no listener: fine */
    }
    return next;
  }

  return {
    storageKey: cfg.storageKey,
    topicKey: cfg.topicKey,
    event: cfg.event,
    parse,
    read,
    has: (key) => read().some((e) => e.key === key),
    add,
    /** The last topic picked on this device, or null. */
    readTopic() {
      try {
        const v = storage()?.getItem(cfg.topicKey) ?? null;
        return cfg.isTopic(v) ? v : null;
      } catch {
        return null;
      }
    },
    writeTopic(t) {
      if (!cfg.isTopic(t)) return;
      try {
        storage()?.setItem(cfg.topicKey, t);
      } catch {
        /* not remembered: fine */
      }
    },
  };
}

/** Nguyên's Sổ tay thám tử (R7c). Keys must never change: they hold what she kept. */
export const DOSSIER_NOTEBOOK = createNotebook<DossierTopic>({
  storageKey: "dossier-notebook",
  topicKey: "dossier-topic",
  event: "dossier:saved",
  findShown: findShownDossier,
  isTopic: isDossierTopic,
});

/** An's Sổ tay nhà khoa học (R7d). Separate keys: the two notebooks never mix. */
export const FIELD_NOTEBOOK = createNotebook<ScienceTopic>({
  storageKey: "field-notebook",
  topicKey: "field-topic",
  event: "field-notes:saved",
  findShown: findShownFieldNote,
  isTopic: isScienceTopic,
});

// R7c names for Nguyên's notebook (kept so existing callers and tests read the same).
export const NOTEBOOK_KEY = DOSSIER_NOTEBOOK.storageKey;
export const TOPIC_KEY = DOSSIER_NOTEBOOK.topicKey;
/** Window event fired after a card is saved (the notebook column listens to it). */
export const NOTEBOOK_EVENT = DOSSIER_NOTEBOOK.event;
export const parseNotebook = DOSSIER_NOTEBOOK.parse;
export const readNotebook = DOSSIER_NOTEBOOK.read;
export const isInNotebook = DOSSIER_NOTEBOOK.has;
export const addToNotebook = DOSSIER_NOTEBOOK.add;
export const readTopic = DOSSIER_NOTEBOOK.readTopic;
export const writeTopic = DOSSIER_NOTEBOOK.writeTopic;
