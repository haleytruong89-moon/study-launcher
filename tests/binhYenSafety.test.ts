import { describe, expect, it } from "vitest";
import { detectRisk, fold, normalize } from "@/lib/binhYen/safety";

// Spike S3 (docs/BINH_YEN.md R3 + BINH_YEN_CATALOG.md §C): 2-level on-device check.
// Expected answers are the proposal the parent reviews; change the catalog, not the test, if
// the parent decides differently.

const STRONG = [
  "con muốn chết",
  "Con muốn chết.",
  "mình muốn chết quá",
  "muốn chết",
  "con muon chet",
  "toi muon chet roi",
  "mún chết quá đi",
  "mun chet",
  "chếtttt đi cho xong",
  "tớ không muốn sống nữa",
  "ko mun song nua",
  "k muon song",
  "sống để làm gì",
  "song de lam gi",
  "không ai cần mình cả",
  "mình là gánh nặng của mọi người",
  "tự tử",
  "nghĩ đến chuyện tự sát",
  "muốn tự làm đau mình",
  "rạch tay",
  "muốn biến mất mãi mãi",
  "không muốn tồn tại",
  "ngủ luôn không dậy cũng được",
  "kms",
  "I want to die",
  "kill myself",
  "m u ố n c h ế t",
  "c.h.ế.t đi cho xong",
];

const ASK = [
  "mệt muốn chết",
  "chán muốn chết",
  "buồn muốn chết",
  "đau bụng muốn chết",
  "cắt tay vào giấy",
  "muốn biến mất khỏi lớp này",
  "chán sống quá",
  "không chịu nổi nữa",
  "tu tu",
  "lam bai tu tu",
  "muốn ngủ mãi",
];

const NONE = [
  "từ từ thôi",
  "làm từ từ cũng được",
  "ôn tư tưởng Hồ Chí Minh",
  "đói chết mất",
  "bài khó quá chết mất",
  "chết cười",
  "buồn cười muốn chết",
  "cười muốn chết",
  "nóng muốn chết",
  "sợ muốn chết",
  "ngon muốn chết",
  "bài này giết mình",
  "game này chết hoài",
  "nhân vật chết rồi hồi sinh",
  "hôm nay vui",
  "lo lắng vì bài kiểm tra",
  "bị bạn trêu",
  "gánh nặng bài vở",
  "cắt tóc",
  "",
  "   ",
  "tu tuong lop 9",
  "tự tin",
  "không muốn đi học",
  "không muốn ăn",
];

describe("detectRisk", () => {
  it("has a test set of at least 50 sentences", () => {
    expect(STRONG.length + ASK.length + NONE.length).toBeGreaterThanOrEqual(50);
  });
  it.each(STRONG)("strong: %s", (s) => expect(detectRisk(s)).toBe("strong"));
  it.each(ASK)("ask: %s", (s) => expect(detectRisk(s)).toBe("ask"));
  it.each(NONE)("nothing: %s", (s) => expect(detectRisk(s)).toBeNull());
});

describe("normalize / fold", () => {
  it("collapses repeated letters and spaced-out words", () => {
    expect(normalize("Chếtttt!!!")).toBe("chết");
    expect(normalize("m u ố n   c h ế t")).toBe("muốnchết");
    expect(fold(normalize("Đường đi"))).toBe("duong di");
    expect(fold("Đ")).toBe("D");
  });
});
