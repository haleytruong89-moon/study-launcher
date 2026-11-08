import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { QUAD_KEYS } from "@/lib/binhYen/catalog";
import { fitsQuad } from "@/lib/binhYen/dossier";
import {
  FIELD_NOTES,
  SCIENCE_TOPICS,
  SCIENCE_TOPIC_KEYS,
  SCIENCE_TOPIC_TARGET,
  activeScienceTopics,
  fieldNoteFor,
  findFieldNote,
  findShownFieldNote,
  isScienceTopic,
  type FieldNote,
  type ScienceTopic,
} from "@/lib/binhYen/fieldNotes";
import { DOC_FILE, NOTE_SOURCES } from "@/scripts/field-notes-doc";

const KEY = /^[a-z][a-z0-9_]{1,47}$/;

/** Sentence ends: . ! ? … followed by optional closing quotes/brackets, then whitespace or the end. */
const sentences = (s: string) => (s.trim().match(/[.!?…]+["”’)»]*(?=\s|$)/g) ?? []).length;

/** Words the cards must never contain: Nguyên's list (tests/dossier.test.ts) plus the R7d animal-safety words. */
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
  // R7d: nothing scary or sad about animals.
  /chết/i,
  /giết/i,
  /săn mồi/i,
  /tuyệt chủng/i,
  /đáng sợ/i,
];

const allText = (d: FieldNote) => [d.title, d.body, d.tryIt ?? "", d.source];
const SHOWN = FIELD_NOTES.filter((d) => !d.held);
const count = (t: ScienceTopic) => FIELD_NOTES.filter((d) => d.topic === t).length;
/** Topics written so far (the second half of the deck is added later; empty topics are not offered). */
const FILLED = SCIENCE_TOPIC_KEYS.filter((t) => count(t) > 0);
const EMPTY = SCIENCE_TOPIC_KEYS.filter((t) => count(t) === 0);

describe("Sổ tay nhà khoa học content rules", () => {
  it("has 9 topics in chip order, each with a label, an emoji and a target count (80 in all)", () => {
    expect(SCIENCE_TOPIC_KEYS).toEqual(["dong_vat", "ky_thu", "thien_nhien", "trai_dat", "vu_tru", "cay_coi", "bo_nao", "cam_xuc", "thi_nghiem"]);
    for (const t of SCIENCE_TOPIC_KEYS) {
      expect(SCIENCE_TOPICS[t].label.trim()).not.toBe("");
      expect(SCIENCE_TOPICS[t].emoji.trim()).not.toBe("");
      expect(SCIENCE_TOPIC_TARGET[t]).toBeGreaterThan(0);
    }
    expect(Object.values(SCIENCE_TOPIC_TARGET).reduce((a, b) => a + b, 0)).toBe(80);
    expect(isScienceTopic("dong_vat")).toBe(true);
    expect(isScienceTopic("vu_tru")).toBe(true);
    expect(isScienceTopic("nao")).toBe(false);
    expect(isScienceTopic(null)).toBe(false);
  });

  it("the feelings-linked first half is complete: 40 cards", () => {
    for (const t of ["dong_vat", "thien_nhien", "bo_nao", "cam_xuc", "thi_nghiem"] as const) expect(count(t), t).toBe(SCIENCE_TOPIC_TARGET[t]);
    expect(FIELD_NOTES.length).toBeGreaterThanOrEqual(40);
  });

  it("every topic that has cards has exactly its target count", () => {
    for (const t of FILLED) expect(count(t), t).toBe(SCIENCE_TOPIC_TARGET[t]);
  });

  for (const t of EMPTY) it.todo(`${t}: add ${SCIENCE_TOPIC_TARGET[t]} cards (second half of the deck)`);

  it("has unique, stable-looking keys", () => {
    const keys = FIELD_NOTES.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(KEY);
  });

  for (const d of FIELD_NOTES) {
    it(`${d.key}: title, a 2–4 sentence body ≤ 380 chars, a source, valid quads`, () => {
      expect(d.title.trim().length).toBeGreaterThan(3);
      expect(d.title.length).toBeLessThanOrEqual(60);
      expect(d.body.length, d.body).toBeLessThanOrEqual(380);
      const n = sentences(d.body);
      expect(n, d.body).toBeGreaterThanOrEqual(2);
      expect(n, d.body).toBeLessThanOrEqual(4);
      expect(d.source.trim()).not.toBe("");
      if (d.tryIt !== undefined) {
        expect(d.tryIt.trim()).not.toBe("");
        expect(d.tryIt.length).toBeLessThanOrEqual(140);
      }
      if (d.topic === "thi_nghiem") expect(d.tryIt ?? "", `${d.key} needs a “Ghi chép:” line`).toContain("Ghi chép:");
      expect(new Set(d.quads).size).toBe(d.quads.length);
      for (const q of d.quads) expect(QUAD_KEYS).toContain(q);
      for (const s of allText(d)) expect(s, `${d.key} not NFC`).toBe(s.normalize("NFC"));
    });
  }

  it("the forbidden list catches the animal-safety words and “hỏng”, not “mô phỏng”", () => {
    const hit = (t: string) => FORBIDDEN.some((re) => re.test(t));
    for (const w of ["con vật chết", "giết", "săn mồi", "tuyệt chủng", "Đáng sợ quá", "Hỏng rồi.", "con nên làm"]) expect(hit(w), w).toBe(true);
    expect(hit("mô phỏng túp lều")).toBe(false);
  });

  it("contains no forbidden words anywhere in the cards", () => {
    for (const d of FIELD_NOTES) for (const s of allText(d)) for (const re of FORBIDDEN) expect(re.test(s), `${d.key}: ${re} in “${s}”`).toBe(false);
  });

  it("each topic that has cards offers at least 2 non-held cards for every quad", () => {
    for (const t of FILLED) for (const q of QUAD_KEYS) expect(SHOWN.filter((d) => d.topic === t && fitsQuad(d, q)).length, `${t}/${q}`).toBeGreaterThanOrEqual(2);
  });

  it("held cards (if any) carry a reason and are never found as shown", () => {
    for (const d of FIELD_NOTES.filter((x) => x.held)) {
      expect(d.heldReason?.trim()).toBeTruthy();
      expect(findShownFieldNote(d.key)).toBeUndefined();
    }
    for (const d of SHOWN) expect(d.heldReason, d.key).toBeUndefined();
  });

  it("findFieldNote / findShownFieldNote find by key", () => {
    expect(findFieldNote("voi_an_ui")?.topic).toBe("dong_vat");
    expect(findShownFieldNote("dem_hoi_tho")?.key).toBe("dem_hoi_tho");
    expect(findFieldNote("chuong_bao_dong")).toBeUndefined(); // Nguyên's deck stays separate
    expect(findFieldNote("nope")).toBeUndefined();
  });

  it("activeScienceTopics lists, in chip order, exactly the topics with shown cards", () => {
    expect(activeScienceTopics()).toEqual(SCIENCE_TOPIC_KEYS.filter((t) => SHOWN.some((d) => d.topic === t)));
    expect(activeScienceTopics()[0]).toBe("dong_vat");
  });
});

describe("fieldNoteFor (selection rule shared with Hồ sơ mật)", () => {
  const day = (k: number) => new Date(Date.UTC(2026, 10, 1 + k)).toISOString().slice(0, 10);

  it("is deterministic: same day, quad and topic → same card", () => {
    for (const t of FILLED) for (const q of [...QUAD_KEYS, null]) expect(fieldNoteFor("2026-11-08", q, t)?.key).toBe(fieldNoteFor("2026-11-08", q, t)?.key);
  });

  it("always returns a shown card of the chosen topic that fits the quad", () => {
    for (let k = 0; k < 40; k++)
      for (const t of FILLED)
        for (const q of QUAD_KEYS) {
          const d = fieldNoteFor(day(k), q, t);
          expect(d, `${day(k)} ${t} ${q}`).not.toBeNull();
          expect(d?.topic).toBe(t);
          expect(d?.held).toBeUndefined();
          expect(fitsQuad(d as FieldNote, q), `${day(k)} ${t} ${q} → ${d?.key}`).toBe(true);
        }
  });

  it("changes from one day to the next and cycles through every fitting card", () => {
    for (const t of FILLED)
      for (const q of QUAD_KEYS) {
        const fit = SHOWN.filter((d) => d.topic === t && fitsQuad(d, q));
        const seen = new Set<string>();
        let prev = "";
        for (let k = 0; k < fit.length; k++) {
          const key = fieldNoteFor(day(7 + k), q, t)?.key ?? "";
          expect(key).not.toBe(prev);
          prev = key;
          seen.add(key);
        }
        expect(seen.size, `${t}/${q}`).toBe(fit.length);
      }
  });

  it("no quad → any card of the topic", () => {
    const keys = new Set(Array.from({ length: 12 }, (_, k) => fieldNoteFor(day(k), null, "dong_vat")?.key));
    expect(keys.size).toBe(12);
  });

  it("returns null for a topic with no cards yet", () => {
    for (const t of EMPTY) expect(fieldNoteFor("2026-11-08", "red", t)).toBeNull();
  });
});

describe("the reading copy for parents (docs/binh-yen/SO_TAY_KHOA_HOC.md)", () => {
  const md = readFileSync(DOC_FILE, "utf8");

  it("has every card's title, body, thử nhỏ and source line", () => {
    for (const d of FIELD_NOTES) for (const s of allText(d).filter(Boolean)) expect(md, `${d.key}: ${s}`).toContain(s);
  });

  it("has at least one checked https link for every card", () => {
    expect(Object.keys(NOTE_SOURCES).sort()).toEqual(FIELD_NOTES.map((d) => d.key).sort());
    for (const d of FIELD_NOTES) {
      const refs = NOTE_SOURCES[d.key] ?? [];
      expect(refs.length, d.key).toBeGreaterThan(0);
      for (const r of refs) {
        expect(r.url).toMatch(/^https:\/\//);
        expect(md).toContain(r.url);
      }
    }
    expect(md).toContain("08/11/2026");
  });

  it("lists topics with cards in chip order and skips empty topics", () => {
    let last = -1;
    for (const t of FILLED) {
      const at = md.indexOf(`## ${SCIENCE_TOPICS[t].emoji} ${SCIENCE_TOPICS[t].label}\n`);
      expect(at, t).toBeGreaterThan(last);
      last = at;
    }
    for (const t of EMPTY) expect(md).not.toContain(`## ${SCIENCE_TOPICS[t].emoji} ${SCIENCE_TOPICS[t].label}\n`);
  });

  it("has the safety rules, how cards are shown, the sources table and the fact-checker list", () => {
    expect(md).toContain("## Luật an toàn nội dung");
    expect(md).toContain("## Cách thẻ hiện ra");
    expect(md).toContain("## Bảng nguồn");
    expect(md).toContain("## Điểm cần soát kỹ");
    expect(md).toMatch(/chỉ trên máy của con/);
    expect(md).toMatch(/Bố mẹ không thấy/);
  });
});
