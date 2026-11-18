/**
 * Cards already shown TODAY on this device (18/11/2026), so a second visit or "Một điều khác ›"
 * shows a different one. Browser storage only, never sent anywhere; any storage failure just
 * means "nothing seen yet". One list per deck, reset each day.
 */
const KEY = (deck: string) => `by-seen-${deck}`;

interface Stored {
  date: string;
  keys: string[];
}

export function readSeen(deck: string, today: string): Set<string> {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY(deck)) ?? "null") as Stored | null;
    return v && v.date === today && Array.isArray(v.keys) ? new Set(v.keys.filter((k) => typeof k === "string")) : new Set();
  } catch {
    return new Set();
  }
}

export function markSeen(deck: string, today: string, key: string): void {
  try {
    const seen = readSeen(deck, today);
    seen.add(key);
    window.localStorage.setItem(KEY(deck), JSON.stringify({ date: today, keys: [...seen].slice(-200) } satisfies Stored));
  } catch {
    // Private mode / storage full: the next visit may repeat a card, nothing else.
  }
}
