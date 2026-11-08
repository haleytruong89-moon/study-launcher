import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DOSSIERS } from "@/lib/binhYen/dossier";
import { FIELD_NOTES } from "@/lib/binhYen/fieldNotes";
import { DOSSIER_NOTEBOOK, FIELD_NOTEBOOK, NOTEBOOK_EVENT, NOTEBOOK_KEY, TOPIC_KEY, addToNotebook, readNotebook, readTopic } from "@/lib/binhYen/notebook";

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

const NOTE = FIELD_NOTES.filter((d) => !d.held).map((d) => d.key) as [string, string, ...string[]];
const DOSSIER = DOSSIERS.filter((d) => !d.held).map((d) => d.key) as [string, string, ...string[]];

describe("Sổ tay nhà khoa học (An, this browser only, R7d)", () => {
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

  it("uses its own keys and event; Nguyên's stay exactly as in R7c", () => {
    expect(FIELD_NOTEBOOK.storageKey).toBe("field-notebook");
    expect(FIELD_NOTEBOOK.topicKey).toBe("field-topic");
    expect(FIELD_NOTEBOOK.event).toBe("field-notes:saved");
    expect([NOTEBOOK_KEY, TOPIC_KEY, NOTEBOOK_EVENT]).toEqual(["dossier-notebook", "dossier-topic", "dossier:saved"]);
    expect([DOSSIER_NOTEBOOK.storageKey, DOSSIER_NOTEBOOK.topicKey, DOSSIER_NOTEBOOK.event]).toEqual(["dossier-notebook", "dossier-topic", "dossier:saved"]);
  });

  it("saves An's cards under field-notebook, newest first, and fires field-notes:saved", () => {
    FIELD_NOTEBOOK.add("2026-11-07", NOTE[0]);
    FIELD_NOTEBOOK.add("2026-11-08", NOTE[1]);
    expect(FIELD_NOTEBOOK.read()).toEqual([
      { date: "2026-11-08", key: NOTE[1] },
      { date: "2026-11-07", key: NOTE[0] },
    ]);
    expect(events).toEqual(["field-notes:saved", "field-notes:saved"]);
    expect(JSON.parse(ls.getItem("field-notebook") ?? "[]")).toHaveLength(2);
    expect(ls.getItem("dossier-notebook")).toBeNull();
  });

  it("isolation: saving in one deck never shows in the other", () => {
    FIELD_NOTEBOOK.add("2026-11-08", NOTE[0]);
    expect(readNotebook()).toEqual([]);
    expect(DOSSIER_NOTEBOOK.has(NOTE[0])).toBe(false);

    addToNotebook("2026-11-08", DOSSIER[0]);
    expect(FIELD_NOTEBOOK.read()).toEqual([{ date: "2026-11-08", key: NOTE[0] }]);
    expect(FIELD_NOTEBOOK.has(DOSSIER[0])).toBe(false);
  });

  it("ignores the other deck's keys even if they end up in its storage", () => {
    // Same key in both decks ("goi_ten_cam_xuc") is the one exception: each deck reads its own card.
    const onlyDossier = DOSSIER.filter((k) => !NOTE.includes(k));
    const onlyNote = NOTE.filter((k) => !DOSSIER.includes(k));
    ls.setItem("field-notebook", JSON.stringify(onlyDossier.map((key) => ({ date: "2026-11-08", key }))));
    expect(FIELD_NOTEBOOK.read()).toEqual([]);
    ls.setItem("dossier-notebook", JSON.stringify(onlyNote.map((key) => ({ date: "2026-11-08", key }))));
    expect(readNotebook()).toEqual([]);
    FIELD_NOTEBOOK.add("2026-11-08", onlyDossier[0]!);
    addToNotebook("2026-11-08", onlyNote[0]!);
    expect(events).toEqual([]);
  });

  it("remembers An's topic separately; ignores the other deck's topics", () => {
    FIELD_NOTEBOOK.writeTopic("vu_tru");
    expect(ls.getItem("field-topic")).toBe("vu_tru");
    expect(FIELD_NOTEBOOK.readTopic()).toBe("vu_tru");
    expect(readTopic()).toBeNull();
    ls.setItem("field-topic", "lich_su");
    expect(FIELD_NOTEBOOK.readTopic()).toBeNull();
    FIELD_NOTEBOOK.writeTopic("nao" as never);
    expect(ls.getItem("field-topic")).toBe("lich_su");
  });
});
