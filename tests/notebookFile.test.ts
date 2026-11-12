import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DOSSIERS, findShownDossier } from "@/lib/binhYen/dossier";
import { FIELD_NOTES, findShownFieldNote } from "@/lib/binhYen/fieldNotes";
import { DOSSIER_NOTEBOOK, FIELD_NOTEBOOK, NOTEBOOK_CAP, type NotebookEntry } from "@/lib/binhYen/notebook";
import { NOTEBOOK_FILE_MAX_BYTES, mergeNotebook, notebookFileName, parseNotebookFile, serializeNotebook } from "@/lib/binhYen/notebookFile";

const NOTE = FIELD_NOTES.filter((d) => !d.held).map((d) => d.key) as [string, string, string, ...string[]];
const DOSSIER = DOSSIERS.filter((d) => !d.held).map((d) => d.key) as [string, string, string, ...string[]];
const HELD = DOSSIERS.filter((d) => d.held).map((d) => d.key);

describe("Sổ tay file: serialize / parse (Đợt 4)", () => {
  it("names the file by date", () => {
    expect(notebookFileName("2026-11-12")).toBe("so-tay-2026-11-12.json");
    expect(notebookFileName("nope")).toBe("so-tay-sao-luu.json");
  });

  it("round-trips ids and dates, and holds no card text", () => {
    const entries: NotebookEntry[] = [
      { date: "2026-11-12", key: NOTE[0] },
      { date: "2026-11-10", key: NOTE[1] },
    ];
    const text = serializeNotebook("field", entries);
    expect(JSON.parse(text)).toEqual({ version: 1, kind: "field", pages: entries.map((e) => ({ key: e.key, date: e.date })) });
    const card = findShownFieldNote(NOTE[0])!;
    expect(text).not.toContain(card.title);
    expect(text).not.toContain(card.body.slice(0, 20));
    expect(parseNotebookFile(text, "field", findShownFieldNote)).toEqual({ ok: true, pages: entries, skipped: 0 });
  });

  it("rejects the other child's notebook kind", () => {
    const text = serializeNotebook("dossier", [{ date: "2026-11-12", key: DOSSIER[0] }]);
    expect(parseNotebookFile(text, "field", findShownFieldNote)).toEqual({ ok: false, reason: "wrong_kind" });
    expect(parseNotebookFile(text, "dossier", findShownDossier).ok).toBe(true);
  });

  it("skips and counts unknown or held ids; keeps the earliest date of a repeated id", () => {
    const text = JSON.stringify({
      version: 1,
      kind: "dossier",
      pages: [
        { key: DOSSIER[0], date: "2026-11-09" },
        { key: "khong_co_ho_so_nay", date: "2026-11-09" },
        ...HELD.map((key) => ({ key, date: "2026-11-08" })),
        { key: DOSSIER[0], date: "2026-11-02" },
        { key: NOTE[0], date: "2026-11-01" },
      ],
    });
    const r = parseNotebookFile(text, "dossier", findShownDossier);
    expect(r).toEqual({ ok: true, pages: [{ key: DOSSIER[0], date: "2026-11-02" }], skipped: 2 + HELD.length });
  });

  it("rejects malformed JSON and anything not exactly the file shape", () => {
    const ok = { version: 1, kind: "field", pages: [{ key: NOTE[0], date: "2026-11-12" }] };
    const bad: unknown[] = [
      "",
      "{",
      "null",
      "[]",
      '"so tay"',
      JSON.stringify({ ...ok, version: 2 }),
      JSON.stringify({ ...ok, version: "1" }),
      JSON.stringify({ ...ok, kind: "diary" }),
      JSON.stringify({ ...ok, extra: true }),
      JSON.stringify({ version: 1, kind: "field" }),
      JSON.stringify({ ...ok, pages: [{ key: NOTE[0], date: "12/11/2026" }] }),
      JSON.stringify({ ...ok, pages: [{ key: NOTE[0], date: "2026-11-12", title: "x" }] }),
      JSON.stringify({ ...ok, pages: [{ key: "<script>", date: "2026-11-12" }] }),
      JSON.stringify({ ...ok, pages: [{ key: 7, date: "2026-11-12" }] }),
      JSON.stringify({ ...ok, pages: "all" }),
      JSON.stringify({ ...ok, pages: Array.from({ length: 2001 }, () => ({ key: NOTE[0], date: "2026-11-12" })) }),
    ];
    for (const text of bad) expect(parseNotebookFile(text as string, "field", findShownFieldNote).ok, String(text).slice(0, 60)).toBe(false);
    expect(parseNotebookFile("{", "field", findShownFieldNote)).toEqual({ ok: false, reason: "not_json" });
    expect(parseNotebookFile(JSON.stringify(ok), "field", findShownFieldNote).ok).toBe(true);
  });

  it("rejects an oversize file before parsing it", () => {
    const pad = " ".repeat(NOTEBOOK_FILE_MAX_BYTES);
    const text = serializeNotebook("field", [{ date: "2026-11-12", key: NOTE[0] }]) + pad;
    expect(parseNotebookFile(text, "field", findShownFieldNote)).toEqual({ ok: false, reason: "too_big" });
  });
});

describe("Sổ tay file: merge (never deletes)", () => {
  it("unions keys, keeps the earliest date, newest first, counts new pages", () => {
    const current: NotebookEntry[] = [
      { date: "2026-11-12", key: NOTE[0] },
      { date: "2026-11-05", key: NOTE[1] },
    ];
    const incoming: NotebookEntry[] = [
      { date: "2026-11-01", key: NOTE[0] },
      { date: "2026-11-08", key: NOTE[2] },
      { date: "2026-11-09", key: NOTE[1] },
    ];
    const r = mergeNotebook(current, incoming);
    expect(r.added).toBe(1);
    expect(r.entries).toEqual([
      { date: "2026-11-08", key: NOTE[2] },
      { date: "2026-11-05", key: NOTE[1] },
      { date: "2026-11-01", key: NOTE[0] },
    ]);
    // Inputs untouched.
    expect(current[0]).toEqual({ date: "2026-11-12", key: NOTE[0] });
  });

  it("loading the same file twice adds nothing", () => {
    const current: NotebookEntry[] = [{ date: "2026-11-12", key: NOTE[0] }];
    const once = mergeNotebook(current, [{ date: "2026-11-11", key: NOTE[1] }]);
    const twice = mergeNotebook(once.entries, [{ date: "2026-11-11", key: NOTE[1] }]);
    expect(twice).toEqual({ entries: once.entries, added: 0 });
  });

  it("is capped", () => {
    const many = Array.from({ length: NOTEBOOK_CAP + 5 }, (_, i) => ({ date: "2026-11-12", key: `k${i}` }));
    expect(mergeNotebook([], many).entries).toHaveLength(NOTEBOOK_CAP);
  });
});

describe("Sổ tay store.replace", () => {
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
  const g = globalThis as unknown as { window?: { localStorage: MemStorage; dispatchEvent?: (e: Event) => boolean } };
  let events: string[] = [];
  let ls: MemStorage;
  beforeEach(() => {
    events = [];
    ls = new MemStorage();
    g.window = { localStorage: ls, dispatchEvent: (e: Event) => (events.push(e.type), true) };
  });
  afterEach(() => {
    delete g.window;
  });

  it("stores a merged notebook in its own key only, cleaned, and fires its event", () => {
    FIELD_NOTEBOOK.add("2026-11-12", NOTE[0]);
    events = [];
    const { entries } = mergeNotebook(FIELD_NOTEBOOK.read(), [
      { date: "2026-11-02", key: NOTE[1] },
      { date: "2026-11-01", key: DOSSIER[0] },
    ]);
    expect(FIELD_NOTEBOOK.replace(entries)).toBe(true);
    expect(FIELD_NOTEBOOK.read()).toEqual([
      { date: "2026-11-12", key: NOTE[0] },
      { date: "2026-11-02", key: NOTE[1] },
    ]);
    expect(events).toEqual(["field-notes:saved"]);
    expect(ls.getItem(DOSSIER_NOTEBOOK.storageKey)).toBeNull();
  });

  it("returns false and keeps the old notebook when the browser cannot store", () => {
    FIELD_NOTEBOOK.add("2026-11-12", NOTE[0]);
    ls.throwOnSet = true;
    expect(FIELD_NOTEBOOK.replace([{ date: "2026-11-01", key: NOTE[1] }])).toBe(false);
    expect(FIELD_NOTEBOOK.read()).toEqual([{ date: "2026-11-12", key: NOTE[0] }]);
  });

  it("returns false without storage", () => {
    delete g.window;
    expect(FIELD_NOTEBOOK.replace([{ date: "2026-11-01", key: NOTE[1] }])).toBe(false);
  });
});
