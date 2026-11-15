import { describe, expect, it } from "vitest";
import { buildLearningTiles, homeLine, needsLook, sourceLabel, tileCounts, type LearningAttentionRow, type LearningCardRow } from "@/lib/parent/learning";

const AN = "child-an";
const NG = "child-ng";
const DAY = "2026-11-16";

const card = (over: Partial<LearningCardRow> = {}): LearningCardRow => ({
  child_id: AN,
  local_date: DAY,
  source: "tutor:toan",
  sessions: 2,
  minutes: 35,
  problems: 5,
  self_solved: 3,
  saved_for_later: 1,
  abandoned: 1,
  pending_review: 0,
  report_path: null,
  ...over,
});
const line = (slot: number, body: string, over: Partial<LearningAttentionRow> = {}): LearningAttentionRow => ({ child_id: AN, local_date: DAY, source: "tutor:toan", slot, body, ...over });

describe("L-3 learning tiles", () => {
  it("labels: tutor subjects in Vietnamese, unknown sources stay readable", () => {
    expect(sourceLabel("tutor:toan")).toBe("Gia sư AI Toán");
    expect(sourceLabel("tutor:anh")).toBe("Gia sư AI Anh");
    expect(sourceLabel("tutor:khtn")).toBe("Gia sư AI KHTN");
    expect(sourceLabel("app:math-os")).toBe("app math-os");
  });

  it("one tile per source for that child and day; other child / day ignored", () => {
    const tiles = buildLearningTiles(AN, DAY, [card(), card({ child_id: NG }), card({ local_date: "2026-11-15" })], [], [], true);
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toMatchObject({ label: "Gia sư AI Toán", stats: { minutes: 35, sessions: 2, problems: 5, selfSolved: 3 }, reportHref: null });
  });

  it("report link only from the app's own path (none before tutor G7), on this site", () => {
    const at = (report_path: string | null, on = true) => buildLearningTiles(AN, DAY, [card({ report_path })], [], [], on)[0]?.reportHref;
    expect(at("/gia-su/bo-me/bao-cao?ngay=2026-11-16")).toBe("/gia-su/bo-me/bao-cao?ngay=2026-11-16");
    expect(at(null)).toBeNull();
    expect(at("https://evil.example/x")).toBeNull();
    expect(at("//evil.example/x")).toBeNull();
    expect(at("/gia-su/bo-me", false)).toBeNull();
  });

  it("no tutor app configured → no report link; rules shown as text", () => {
    const [t] = buildLearningTiles(AN, DAY, [card({ report_path: "/gia-su/x" })], [], [{ child_id: AN, app: "tutor", pending: 2 }], false);
    expect(t?.reportHref).toBeNull();
    expect(t?.pendingRules).toBe(2);
    expect(t?.rulesHref).toBeNull();
  });

  it("at most 2 attention lines, in slot order, blank lines dropped", () => {
    const [t] = buildLearningTiles(AN, DAY, [card()], [line(2, "Hai"), line(1, " Một "), line(1, "   ", { source: "tutor:anh" })], [], true);
    expect(t?.attention).toEqual(["Một", "Hai"]);
  });

  it("attention without a card still makes a tile (stats null)", () => {
    const tiles = buildLearningTiles(AN, DAY, [], [line(1, "An thấy bài này dài, khó hiểu")], [], true);
    expect(tiles).toEqual([expect.objectContaining({ source: "tutor:toan", stats: null, attention: ["An thấy bài này dài, khó hiểu"] })]);
  });

  it("pending rules go on the first tutor tile, or a small Gia sư AI tile", () => {
    const rules = [{ child_id: AN, app: "tutor", pending: 1 }, { child_id: NG, app: "tutor", pending: 5 }];
    const [first] = buildLearningTiles(AN, DAY, [card()], [], rules, true);
    expect(first).toMatchObject({ pendingRules: 1, rulesHref: "/gia-su/bo-me" });
    expect(buildLearningTiles(AN, DAY, [], [], rules, true)).toEqual([expect.objectContaining({ label: "Gia sư AI", stats: null, pendingRules: 1 })]);
    expect(buildLearningTiles(AN, DAY, [], [], [], true)).toEqual([]);
  });

  it("more minutes first", () => {
    const tiles = buildLearningTiles(AN, DAY, [card({ source: "tutor:anh", minutes: 10 }), card({ minutes: 40 })], [], [], true);
    expect(tiles.map((t) => t.label)).toEqual(["Gia sư AI Toán", "Gia sư AI Anh"]);
  });

  it("counts line leaves zeros out", () => {
    expect(tileCounts({ minutes: 1, sessions: 1, problems: 5, selfSolved: 3, savedForLater: 1, abandoned: 1, pendingReview: 0 })).toBe("5 bài hỏi cô · 3 tự làm xong · 1 để dành · 1 bỏ dở");
    expect(tileCounts({ minutes: 1, sessions: 1, problems: 2, selfSolved: 0, savedForLater: 0, abandoned: 0, pendingReview: 1 })).toBe("2 bài hỏi cô · 1 chờ thầy xem");
    expect(tileCounts({ minutes: 1, sessions: 1, problems: 0, selfSolved: 0, savedForLater: 0, abandoned: 0, pendingReview: 0 })).toBe("Chưa có bài nào");
  });

  it("needs-look = attention lines + pending rules; the home line", () => {
    const tiles = buildLearningTiles(AN, DAY, [card()], [line(1, "x")], [{ child_id: AN, app: "tutor", pending: 2 }], true);
    expect(needsLook(tiles)).toBe(3);
    expect(homeLine(tiles)).toBe("Gia sư AI: 35′ · 3 chỗ cần xem");
    expect(homeLine(buildLearningTiles(AN, DAY, [card()], [], [], true))).toBe("Gia sư AI: 35′");
    expect(homeLine([])).toBeNull();
    expect(homeLine(buildLearningTiles(AN, DAY, [card({ minutes: 0 })], [], [], true))).toBeNull();
  });
});
