import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DOSSIERS } from "@/lib/binhYen/dossier";
import { NOTEBOOK_CAP, NOTEBOOK_EVENT, NOTEBOOK_KEY, TOPIC_KEY, addToNotebook, isInNotebook, parseNotebook, readNotebook, readTopic, writeTopic } from "@/lib/binhYen/notebook";

class MemStorage {
  m = new Map<string, string>();
  throwOnSet = false;
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    if (this.throwOnSet) throw new Error("quota");
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

const SHOWN = DOSSIERS.filter((d) => !d.held).map((d) => d.key) as [string, string, string, string, ...string[]];
const HELD = DOSSIERS.filter((d) => d.held).map((d) => d.key);

describe("Sổ tay thám tử (this browser only, R7c)", () => {
  const g = globalThis as unknown as { window?: { localStorage: MemStorage; dispatchEvent?: (e: Event) => boolean } };
  let events: string[] = [];
  beforeEach(() => {
    events = [];
    g.window = { localStorage: new MemStorage(), dispatchEvent: (e: Event) => (events.push(e.type), true) };
  });
  afterEach(() => {
    delete g.window;
  });

  it("starts empty", () => {
    expect(readNotebook()).toEqual([]);
    expect(isInNotebook(SHOWN[0])).toBe(false);
  });

  it("adds newest first and fires dossier:saved", () => {
    addToNotebook("2026-11-07", SHOWN[0]);
    addToNotebook("2026-11-08", SHOWN[1]);
    expect(readNotebook()).toEqual([
      { date: "2026-11-08", key: SHOWN[1] },
      { date: "2026-11-07", key: SHOWN[0] },
    ]);
    expect(events).toEqual([NOTEBOOK_EVENT, NOTEBOOK_EVENT]);
    expect(isInNotebook(SHOWN[0])).toBe(true);
  });

  it("dedupes by key, moving a re-saved card to the top", () => {
    addToNotebook("2026-11-06", SHOWN[0]);
    addToNotebook("2026-11-07", SHOWN[1]);
    addToNotebook("2026-11-08", SHOWN[0]);
    expect(readNotebook()).toEqual([
      { date: "2026-11-08", key: SHOWN[0] },
      { date: "2026-11-07", key: SHOWN[1] },
    ]);
  });

  it("ignores unknown keys, held keys and bad dates (no event)", () => {
    addToNotebook("2026-11-08", "khong_co_the_nay");
    for (const k of HELD) addToNotebook("2026-11-08", k);
    addToNotebook("8/11/2026", SHOWN[0]);
    expect(readNotebook()).toEqual([]);
    expect(events).toEqual([]);
  });

  it(`keeps at most ${NOTEBOOK_CAP} entries, one per key`, () => {
    // There are fewer real cards than the cap, so a long stored list collapses to one entry per key.
    const long = Array.from({ length: NOTEBOOK_CAP + 50 }, (_, i) => ({ date: "2026-11-08", key: SHOWN[i % SHOWN.length]! }));
    const parsed = parseNotebook(JSON.stringify(long));
    expect(parsed).toHaveLength(Math.min(SHOWN.length, NOTEBOOK_CAP));
    expect(new Set(parsed.map((e) => e.key)).size).toBe(parsed.length);
    for (const k of SHOWN) addToNotebook("2026-11-08", k);
    expect(readNotebook().length).toBeLessThanOrEqual(NOTEBOOK_CAP);
  });

  it("survives broken JSON and wrong shapes", () => {
    g.window!.localStorage.setItem(NOTEBOOK_KEY, "{not json");
    expect(readNotebook()).toEqual([]);
    g.window!.localStorage.setItem(NOTEBOOK_KEY, JSON.stringify({ a: 1 }));
    expect(readNotebook()).toEqual([]);
    g.window!.localStorage.setItem(NOTEBOOK_KEY, JSON.stringify([null, 3, "x", { date: 1, key: SHOWN[0] }, { date: "2026-11-08", key: SHOWN[2] }]));
    expect(readNotebook()).toEqual([{ date: "2026-11-08", key: SHOWN[2] }]);
    // Saving still works on top of a broken value.
    g.window!.localStorage.setItem(NOTEBOOK_KEY, "]]");
    addToNotebook("2026-11-08", SHOWN[3]);
    expect(readNotebook()).toEqual([{ date: "2026-11-08", key: SHOWN[3] }]);
  });

  it("a failing write leaves the notebook as it was and fires nothing", () => {
    addToNotebook("2026-11-07", SHOWN[0]);
    events = [];
    g.window!.localStorage.throwOnSet = true;
    expect(addToNotebook("2026-11-08", SHOWN[1])).toEqual([{ date: "2026-11-07", key: SHOWN[0] }]);
    expect(events).toEqual([]);
  });

  it("remembers the topic; ignores bad values", () => {
    expect(readTopic()).toBeNull();
    writeTopic("lich_su");
    expect(readTopic()).toBe("lich_su");
    expect(g.window!.localStorage.getItem(TOPIC_KEY)).toBe("lich_su");
    g.window!.localStorage.setItem(TOPIC_KEY, "bogus");
    expect(readTopic()).toBeNull();
    writeTopic("bogus" as never);
    expect(g.window!.localStorage.getItem(TOPIC_KEY)).toBe("bogus");
  });
});

describe("without window (server render)", () => {
  it("reads empty and writes nothing, without throwing", () => {
    const g = globalThis as unknown as { window?: unknown };
    expect(g.window).toBeUndefined();
    expect(readNotebook()).toEqual([]);
    expect(addToNotebook("2026-11-08", SHOWN[0])).toEqual([]);
    expect(isInNotebook(SHOWN[0])).toBe(false);
    expect(readTopic()).toBeNull();
    expect(() => writeTopic("nao")).not.toThrow();
  });

  it("survives a window whose localStorage getter throws (privacy mode)", () => {
    const g = globalThis as unknown as { window?: object };
    g.window = Object.defineProperty({}, "localStorage", {
      get() {
        throw new Error("denied");
      },
    });
    try {
      expect(readNotebook()).toEqual([]);
      expect(addToNotebook("2026-11-08", SHOWN[0])).toEqual([]);
      expect(readTopic()).toBeNull();
    } finally {
      delete g.window;
    }
  });
});
