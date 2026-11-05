import { describe, expect, it } from "vitest";
import { suggestionText, trustBodySchema, trustSuggestion, weekStartIso, type TrustDecisionRow } from "@/lib/admin/trust";

const AN = "00000000-0000-4000-8000-0000000000a1";
const NGUYEN = "00000000-0000-4000-8000-0000000000a2";
const none = { suggestTrust: false, suggestLock: false };
const up = { suggestTrust: true, suggestLock: false };
const down = { suggestTrust: false, suggestLock: true };
const row = (action: string, payload: Record<string, unknown>): TrustDecisionRow => ({ action, payload, created_at: "2026-11-03T03:00:00Z" });

describe("Tin tưởng: the parent's suggestion card (system suggests, parent decides)", () => {
  it("follows computeDayState's suggestion when nothing was decided this week", () => {
    expect(trustSuggestion(AN, none, [])).toBeNull();
    expect(trustSuggestion(AN, up, [])).toBe("trust");
    expect(trustSuggestion(AN, down, [])).toBe("lock");
  });

  it("'Để sau' hides only that suggestion, only for that child", () => {
    const later = [row("trust.dismissed", { child_id: AN, suggestion: "trust" })];
    expect(trustSuggestion(AN, up, later)).toBeNull();
    expect(trustSuggestion(NGUYEN, up, later)).toBe("trust");
    expect(trustSuggestion(AN, down, later)).toBe("lock");
  });

  it("a switch this week (either way) hides every suggestion until Monday", () => {
    expect(trustSuggestion(AN, down, [row("trust.set", { child_id: AN, mode: "trust" })])).toBeNull();
    expect(trustSuggestion(AN, up, [row("trust.set", { child_id: AN, mode: "lock" })])).toBeNull();
    expect(trustSuggestion(NGUYEN, up, [row("trust.set", { child_id: AN, mode: "trust" })])).toBe("trust");
  });

  it("ignores unrelated or broken rows", () => {
    expect(trustSuggestion(AN, up, [row("override.open", { child_id: AN }), { action: "trust.set", payload: null, created_at: "" }])).toBe("trust");
  });

  it("the week starts on Monday 00:00 in Vietnam", () => {
    expect(weekStartIso("2026-11-04")).toBe("2026-11-01T17:00:00.000Z"); // Mon 02/11 00:00 +07
    expect(weekStartIso("2026-11-08")).toBe("2026-11-01T17:00:00.000Z"); // Sunday: same week
  });

  it("says what changes", () => {
    const t = suggestionText("trust", "An", { weeksMet: 3, weeksNeeded: 3 }, { trustUpPct: 90, trustDownPct: 70 });
    expect(t.title).toBe("An đã đạt 3/3 tuần liên tiếp (≥ 90% ngày đạt) — chuyển sang chế độ Tin tưởng?");
    expect(t.changes.join(" ")).toContain("mở mọi trang");
    expect(t.yes).toBe("Chuyển sang Tin tưởng");
    expect(suggestionText("lock", "An", { weeksMet: 0, weeksNeeded: 3 }, { trustUpPct: 90, trustDownPct: 70 }).title).toBe("Tuần trước An đạt dưới 70% ngày — quay lại chế độ Khóa?");
  });
});

describe("Tin tưởng: request body", () => {
  it("accepts a switch or a 'later', nothing else", () => {
    expect(trustBodySchema.safeParse({ childId: AN, mode: "trust" }).data).toEqual({ childId: AN, mode: "trust", via: "manual" });
    expect(trustBodySchema.safeParse({ childId: AN, later: "lock" }).data).toEqual({ childId: AN, later: "lock" });
    expect(trustBodySchema.safeParse({ childId: AN, mode: "open" }).success).toBe(false);
    expect(trustBodySchema.safeParse({ childId: "x", mode: "trust" }).success).toBe(false);
    expect(trustBodySchema.safeParse({ childId: AN }).success).toBe(false);
  });
});
