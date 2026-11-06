import { describe, expect, it } from "vitest";
import { ACTIVITIES, POOLS, QUAD_KEYS, WORDS, activityText, findActivity, isPleasant, type Quad, type Voice } from "@/lib/binhYen/catalog";
import { suggest } from "@/lib/binhYen/suggest";

// R1 gold table (docs/BINH_YEN.md §5 R1, column "Đáp án đề xuất", incl. the 🔴/🟡 corrections and
// BINH_YEN_CATALOG.md §B). Causes are S-BY3 but the rule already takes them.
// Activity names as the table writes them → keys.
const NAME: Record<string, string> = {
  "Nhảy 1 bài": "dance",
  "Thở cho dịu": "breath",
  "Thở": "breath",
  "Hỏi lại cái đầu": "thought_case",
  "Nhắn bố mẹ": "talk",
  "Kể cho 1 người": "share",
  "Nghỉ / ngủ sớm": "rest",
  "Giữ khoảnh khắc": "savor",
  "3 điều biết ơn": "gratitude",
  "Đo nhịp tim": "heart",
  "Núi lửa trong lọ": "volcano",
  "Lọ bình tĩnh": "jar",
  "Bong bóng chậm": "bubbles",
  "Quan sát bầu trời": "sky",
  "Câu hỏi tò mò": "curious",
};

type Row = [number, Voice, Quad, string, string | null, number | null, string[]];
const GOLD: Row[] = [
  [1, "detective", "red", "tuc_gian", "dienthoai", 3, ["Nhảy 1 bài", "Thở cho dịu", "Hỏi lại cái đầu"]],
  [2, "detective", "red", "lo_lang", "baitap", 2, ["Hỏi lại cái đầu", "Thở cho dịu", "Nhảy 1 bài"]],
  [3, "detective", "red", "lo_lang", "baitap", 5, ["Nhắn bố mẹ", "Hỏi lại cái đầu", "Thở cho dịu"]],
  [4, "detective", "blue", "co_don", "banbe", 3, ["Kể cho 1 người", "Nhắn bố mẹ", "Thở cho dịu"]],
  [5, "detective", "blue", "met", "nguit", 2, ["Thở", "Nghỉ / ngủ sớm", "Kể cho 1 người"]], // 🟡 new activity
  [6, "detective", "blue", "chan", null, 2, ["Nhảy 1 bài", "Kể cho 1 người", "Giữ khoảnh khắc"]], // 🔴 no "Nhắn bố mẹ"
  [7, "detective", "yellow", "tu_hao", "ve", null, ["Giữ khoảnh khắc", "Kể cho 1 người", "3 điều biết ơn"]], // 🟡
  [8, "scientist", "red", "tuc_gian", "chi", 4, ["Nhắn bố mẹ", "Đo nhịp tim", "Núi lửa trong lọ"]],
  [9, "scientist", "red", "lo_lang", "baitap", 2, ["Đo nhịp tim", "Lọ bình tĩnh", "Bong bóng chậm"]],
  [10, "scientist", "blue", "buon", "banbe", 3, ["Kể cho 1 người", "Nhắn bố mẹ", "Quan sát bầu trời"]],
  [11, "scientist", "blue", "chan", "manhinh", 2, ["Câu hỏi tò mò", "Kể cho 1 người", "Núi lửa trong lọ"]],
  [12, "scientist", "yellow", "to_mo", "khampha", null, ["Câu hỏi tò mò", "Kể cho 1 người", "Quan sát bầu trời"]],
];

describe("R1 gold table — every row, in order", () => {
  it.each(GOLD)("#%i", (_n, voice, quad, word, cause, intensity, names) => {
    expect(suggest({ voice, quad, word, cause, intensity })).toEqual(names.map((n) => NAME[n]));
  });
});

describe("R1 rules", () => {
  it("unpleasant + intensity 4 or 5 → 'Nhắn bố mẹ' first, even without a cause (S-BY1)", () => {
    for (const voice of ["detective", "scientist"] as Voice[]) {
      for (const quad of ["red", "blue"] as Quad[]) {
        for (const w of WORDS.filter((x) => x.quad === quad)) {
          expect(suggest({ voice, quad, word: w.key, intensity: 4 })[0]).toBe("talk");
          expect(suggest({ voice, quad, word: w.key, intensity: 5 })[0]).toBe("talk");
        }
      }
    }
  });
  it("lo lắng at 5 with no cause (S-BY1 e2e path) → Nhắn bố mẹ, then breathing is offered", () => {
    const s = suggest({ voice: "detective", quad: "red", word: "lo_lang", intensity: 5 });
    expect(s[0]).toBe("talk");
    expect(s).toContain("breath");
  });
  it("pleasant feelings never put 'Nhắn bố mẹ' first, whatever the intensity sent", () => {
    for (const voice of ["detective", "scientist"] as Voice[]) {
      for (const w of WORDS.filter((x) => isPleasant(x.quad))) expect(suggest({ voice, quad: w.quad, word: w.key, intensity: 5 })[0]).not.toBe("talk");
    }
  });
  it("mild boredom does not send the child to the parents (#6)", () => {
    expect(suggest({ voice: "detective", quad: "blue", word: "chan", intensity: 2 })).not.toContain("talk");
  });
  it("every combination gives 3 different activities from the child's own list, all with texts", () => {
    for (const voice of ["detective", "scientist"] as Voice[]) {
      for (const quad of QUAD_KEYS) {
        for (const w of WORDS.filter((x) => x.quad === quad)) {
          for (const intensity of isPleasant(quad) ? [null] : [1, 2, 3, 4, 5]) {
            const s = suggest({ voice, quad, word: w.key, intensity });
            expect(s).toHaveLength(3);
            expect(new Set(s).size).toBe(3);
            for (const k of s) {
              expect(POOLS[voice]).toContain(k);
              const a = findActivity(k);
              expect(a).toBeDefined();
              expect(activityText(a!, voice).title.length).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });
  it("'Nghỉ một chút / ngủ sớm' is Nguyên's, only for blue feelings, and never first", () => {
    expect(POOLS.detective).toContain("rest");
    expect(POOLS.scientist).not.toContain("rest");
    for (const w of WORDS) {
      const s = suggest({ voice: "detective", quad: w.quad, word: w.key, intensity: 3 });
      if (w.quad !== "blue") expect(s).not.toContain("rest");
      expect(s[0]).not.toBe("rest");
    }
  });
});

describe("activity texts (no text box in S-BY1)", () => {
  it("every activity in a child's list has a title, description, time and a closing line", () => {
    for (const voice of ["detective", "scientist"] as Voice[]) {
      for (const key of POOLS[voice]) {
        const t = activityText(findActivity(key)!, voice);
        expect(t.title && t.desc && t.minutes && t.done).toBeTruthy();
      }
    }
  });
  it("activities that needed typing are done in the head or on paper", () => {
    for (const key of ["thought_case", "evidence", "gratitude", "savor", "release", "curious"]) {
      expect(findActivity(key)?.offline, key).toMatch(/^(head|paper)$/);
    }
  });
  it("keys are short lowercase codes (they are what the server stores)", () => {
    for (const a of ACTIVITIES) expect(a.key).toMatch(/^[a-z0-9_]{1,40}$/);
    for (const w of WORDS) expect(w.key).toMatch(/^[a-z0-9_]{1,40}$/);
  });
});
