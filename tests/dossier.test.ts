import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { QUAD_KEYS, type Quad } from "@/lib/binhYen/catalog";
import { DOSSIERS, TOPICS, TOPIC_KEYS, dayIndex, dossierFor, findDossier, findShownDossier, fitsQuad, isDossierTopic, pickDossier, type Dossier } from "@/lib/binhYen/dossier";
import { CARD_SOURCES, DOC_FILE } from "@/scripts/dossier-doc";

const KEY = /^[a-z][a-z0-9_]{1,47}$/;

/** Sentence ends: . ! ? … followed by optional closing quotes/brackets, then whitespace or the end. */
const sentences = (s: string) => (s.trim().match(/[.!?…]+["”’)»]*(?=\s|$)/g) ?? []).length;

/** Words the cards must never contain (spec "Content safety"). Case-insensitive, NFC text. */
const FORBIDDEN = [
  /rối loạn/i,
  /bệnh/i,
  /triệu chứng/i,
  /điều trị/i,
  /chẩn đoán/i,
  /tự tử/i,
  /tự sát/i,
  /tự hại/i,
  /cân nặng/i,
  /ăn kiêng/i,
  /giảm cân/i,
  /ảo giác/i,
  /(^|[^\p{L}])hỏng($|[^\p{L}])/iu, // a whole word (“mô phỏng” is fine)
  /con nên/i,
  /con phải/i,
  /nên phải/i,
  /bạn nên/i,
  /bạn phải/i,
];

const allText = (d: Dossier) => [d.title, d.body, d.tryIt ?? "", d.source];
const SHOWN = DOSSIERS.filter((d) => !d.held);

describe("Hồ sơ mật content rules", () => {
  it("has 40 cards, 8 per topic, unique stable keys", () => {
    expect(DOSSIERS).toHaveLength(40);
    for (const t of TOPIC_KEYS) expect(DOSSIERS.filter((d) => d.topic === t), t).toHaveLength(8);
    const keys = DOSSIERS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(KEY);
  });

  it("has 5 topics with a label and an emoji", () => {
    expect(TOPIC_KEYS).toEqual(["nao", "cam_xuc", "lich_su", "con_nguoi", "xa_hoi"]);
    for (const t of TOPIC_KEYS) {
      expect(TOPICS[t].label.trim()).not.toBe("");
      expect(TOPICS[t].emoji.trim()).not.toBe("");
    }
    expect(isDossierTopic("nao")).toBe(true);
    expect(isDossierTopic("bogus")).toBe(false);
    expect(isDossierTopic(null)).toBe(false);
  });

  for (const d of DOSSIERS) {
    it(`${d.key}: title, a 2–4 sentence body ≤ 420 chars, a source, valid quads`, () => {
      expect(d.title.trim().length).toBeGreaterThan(3);
      expect(d.title.length).toBeLessThanOrEqual(60);
      expect(d.body.length, d.body).toBeLessThanOrEqual(420);
      const n = sentences(d.body);
      expect(n, d.body).toBeGreaterThanOrEqual(2);
      expect(n, d.body).toBeLessThanOrEqual(4);
      expect(d.source.trim()).not.toBe("");
      if (d.tryIt !== undefined) {
        expect(d.tryIt.trim()).not.toBe("");
        expect(d.tryIt.length).toBeLessThanOrEqual(140);
      }
      expect(new Set(d.quads).size).toBe(d.quads.length);
      for (const q of d.quads) expect(QUAD_KEYS).toContain(q);
      for (const s of allText(d)) expect(s, `${d.key} not NFC`).toBe(s.normalize("NFC"));
    });
  }

  it("the forbidden list catches “ảo giác” and the word “hỏng”, not “mô phỏng”", () => {
    const hit = (t: string) => FORBIDDEN.some((re) => re.test(t));
    expect(hit("Báo động nhầm không có nghĩa là hỏng")).toBe(true);
    expect(hit("Hỏng rồi.")).toBe(true);
    expect(hit("“ảo giác trong suốt”")).toBe(true);
    expect(hit("mô phỏng túp lều")).toBe(false);
  });

  it("contains no forbidden words anywhere in the cards", () => {
    for (const d of DOSSIERS) for (const s of allText(d)) for (const re of FORBIDDEN) expect(re.test(s), `${d.key}: ${re} in “${s}”`).toBe(false);
  });

  it("each topic offers at least 2 non-held cards for every quad (so the fallback is a safety net only)", () => {
    for (const t of TOPIC_KEYS) for (const q of QUAD_KEYS) expect(SHOWN.filter((d) => d.topic === t && fitsQuad(d, q)).length, `${t}/${q}`).toBeGreaterThanOrEqual(2);
  });

  it("holds back lo_la_tap_duot (with a reason) until the parent / counsellor agrees", () => {
    const held = DOSSIERS.filter((d) => d.held);
    expect(held.map((d) => d.key)).toEqual(["lo_la_tap_duot"]);
    for (const d of held) expect(d.heldReason?.trim()).toBeTruthy();
    for (const d of SHOWN) expect(d.heldReason, d.key).toBeUndefined();
    expect(findShownDossier("lo_la_tap_duot")).toBeUndefined();
    expect(findShownDossier("tho_ra_cham")?.key).toBe("tho_ra_cham");
  });

  it("findDossier finds by key", () => {
    expect(findDossier("tho_ra_cham")?.topic).toBe("nao");
    expect(findDossier("nope")).toBeUndefined();
  });
});

describe("dayIndex", () => {
  it("counts whole days since 2026-01-01 in UTC date math", () => {
    expect(dayIndex("2026-01-01")).toBe(0);
    expect(dayIndex("2026-01-02")).toBe(1);
    expect(dayIndex("2026-03-01")).toBe(59);
    expect(dayIndex("2026-11-08")).toBe(311);
    expect(dayIndex("2027-01-01")).toBe(365);
    expect(dayIndex("2025-12-31")).toBe(-1);
  });

  it("returns 0 for bad input", () => {
    expect(dayIndex("")).toBe(0);
    expect(dayIndex("2026-1-1")).toBe(0);
    expect(dayIndex("hôm nay")).toBe(0);
  });
});

describe("dossierFor (selection rule)", () => {
  it("is deterministic: same day, quad and topic → same card", () => {
    for (const t of TOPIC_KEYS) for (const q of QUAD_KEYS) expect(dossierFor("2026-11-08", q, t).key).toBe(dossierFor("2026-11-08", q, t).key);
  });

  it("never selects a held card, on any day, quad or topic", () => {
    for (let k = 0; k < 60; k++) {
      const date = new Date(Date.UTC(2026, 10, 1 + k)).toISOString().slice(0, 10);
      for (const t of TOPIC_KEYS) for (const q of [...QUAD_KEYS, null]) expect(dossierFor(date, q, t).held, `${date} ${t} ${q}`).toBeUndefined();
    }
  });

  it("pickDossier skips held cards even when they are the only fit", () => {
    const mk = (key: string, quads: Quad[], held?: true): Dossier => ({ key, topic: "nao", quads, title: key, body: "Một. Hai.", source: "x", ...(held ? { held } : {}) });
    const list = [mk("h", ["red"], true), mk("h2", ["red"], true), mk("a", ["yellow"]), mk("b", ["green"])];
    const keys = new Set(Array.from({ length: 6 }, (_, k) => pickDossier(list, `2026-01-0${k + 1}`, "red", "nao")?.key));
    expect(keys).toEqual(new Set(["a", "b"]));
    expect(pickDossier([mk("h", [], true)], "2026-01-01", null, "nao")).toBeNull();
  });

  it("always returns a card of the chosen topic that fits the quad", () => {
    for (let k = 0; k < 30; k++) {
      const date = new Date(Date.UTC(2026, 10, 1 + k)).toISOString().slice(0, 10);
      for (const t of TOPIC_KEYS)
        for (const q of QUAD_KEYS) {
          const d = dossierFor(date, q, t);
          expect(d.topic).toBe(t);
          expect(fitsQuad(d, q), `${date} ${t} ${q} → ${d.key}`).toBe(true);
        }
    }
  });

  it("changes from one day to the next and cycles through every fitting card", () => {
    for (const t of TOPIC_KEYS)
      for (const q of QUAD_KEYS) {
        const fit = SHOWN.filter((d) => d.topic === t && fitsQuad(d, q));
        const seen = new Set<string>();
        let prev = "";
        for (let k = 0; k < fit.length; k++) {
          const date = new Date(Date.UTC(2026, 10, 8 + k)).toISOString().slice(0, 10);
          const key = dossierFor(date, q, t).key;
          expect(key).not.toBe(prev);
          prev = key;
          seen.add(key);
        }
        expect(seen.size, `${t}/${q}`).toBe(fit.length);
      }
  });

  it("works for dates before 2026 (negative day index)", () => {
    const d = dossierFor("2025-06-15", "red", "nao");
    expect(d.topic).toBe("nao");
  });

  it("no quad → any card of the topic", () => {
    const keys = new Set(Array.from({ length: 8 }, (_, k) => dossierFor(new Date(Date.UTC(2026, 0, 1 + k)).toISOString().slice(0, 10), null, "lich_su").key));
    expect(keys.size).toBe(8);
    const emo = new Set(Array.from({ length: 7 }, (_, k) => dossierFor(new Date(Date.UTC(2026, 0, 1 + k)).toISOString().slice(0, 10), null, "cam_xuc").key));
    expect(emo.size).toBe(7);
  });

  it("falls back to the whole topic when fewer than 2 cards fit the quad", () => {
    const mk = (key: string, quads: Quad[]): Dossier => ({ key, topic: "nao", quads, title: key, body: "Một. Hai.", source: "x" });
    const list = [mk("a", ["red"]), mk("b", ["yellow"]), mk("c", ["green"]), mk("z", ["yellow"])];
    // Only one card fits red → use all 4 cards of the topic.
    const red = new Set(Array.from({ length: 4 }, (_, k) => pickDossier(list, `2026-01-0${k + 1}`, "red", "nao")?.key));
    expect(red).toEqual(new Set(["a", "b", "c", "z"]));
    // Two cards fit yellow → only those two.
    const yellow = new Set(Array.from({ length: 4 }, (_, k) => pickDossier(list, `2026-01-0${k + 1}`, "yellow", "nao")?.key));
    expect(yellow).toEqual(new Set(["b", "z"]));
    // Empty topic → null.
    expect(pickDossier(list, "2026-01-01", "red", "xa_hoi")).toBeNull();
  });
});

describe("the reading copy for parents (docs/binh-yen/HO_SO_MAT.md)", () => {
  const md = readFileSync(DOC_FILE, "utf8");

  it("has every card's title, body, thử nhỏ and source line", () => {
    for (const d of DOSSIERS) for (const s of allText(d).filter(Boolean)) expect(md, `${d.key}: ${s}`).toContain(s);
  });

  it("has at least one checked https link for every card", () => {
    expect(Object.keys(CARD_SOURCES).sort()).toEqual(DOSSIERS.map((d) => d.key).sort());
    for (const d of DOSSIERS) {
      const refs = CARD_SOURCES[d.key] ?? [];
      expect(refs.length, d.key).toBeGreaterThan(0);
      for (const r of refs) {
        expect(r.url).toMatch(/^https:\/\//);
        expect(md).toContain(r.url);
      }
    }
    expect(md).toContain("08/11/2026");
  });

  it("recommends showing the pack to Nguyên's counsellor", () => {
    expect(md).toMatch(/chuyên gia tư vấn/);
  });

  it("lists held cards in their own section, with the reason, after every shown card", () => {
    const at = md.indexOf("## Chờ bố mẹ / chuyên gia đồng ý (chưa hiện cho con)");
    expect(at).toBeGreaterThan(0);
    for (const d of DOSSIERS.filter((x) => x.held)) {
      expect(md.indexOf(`(\`${d.key}\`)`)).toBeGreaterThan(at);
      expect(md).toContain(d.heldReason as string);
    }
    for (const d of SHOWN) expect(md.indexOf(`(\`${d.key}\`)`), d.key).toBeLessThan(at);
  });
});
