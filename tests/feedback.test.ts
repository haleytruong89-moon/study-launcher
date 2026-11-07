import { describe, expect, it } from "vitest";
import {
  FEEDBACK_DAILY_LIMIT,
  FEEDBACK_KINDS,
  FEEDBACK_LABELS,
  FEEDBACK_NOT_PRIVATE,
  feedbackBodySchema,
  feedbackLimitReached,
  isFeedbackKind,
  tableMissing,
} from "@/lib/feedback/rules";

// "Góp ý" (parent decision 07/11/2026): children's feedback about the app; parents read it.

describe("Góp ý body", () => {
  it("accepts the three kinds with 1–500 characters (trimmed)", () => {
    for (const kind of FEEDBACK_KINDS) expect(feedbackBodySchema.parse({ kind, body: "  Con thích màu mới  " })).toEqual({ kind, body: "Con thích màu mới" });
    expect(feedbackBodySchema.safeParse({ kind: "idea", body: "x".repeat(500) }).success).toBe(true);
  });
  it.each([
    ["empty", { kind: "like", body: "" }],
    ["only spaces", { kind: "like", body: "   \n " }],
    ["501 characters", { kind: "idea", body: "x".repeat(501) }],
    ["an unknown kind", { kind: "angry", body: "x" }],
    ["a family or child sent by the browser", { kind: "like", body: "x", child_id: "00000000-0000-4000-8000-000000000001" }],
    ["no body", { kind: "like" }],
  ])("refuses %s", (_l, v) => expect(feedbackBodySchema.safeParse(v).success).toBe(false));
  it("says in Vietnamese what is wrong with the text", () => {
    const r = feedbackBodySchema.safeParse({ kind: "like", body: "x".repeat(501) });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Tối đa 500 ký tự.");
  });
});

describe("Góp ý limits and wording", () => {
  it("at most 10 per child per day", () => {
    expect(FEEDBACK_DAILY_LIMIT).toBe(10);
    expect(feedbackLimitReached(9)).toBe(false);
    expect(feedbackLimitReached(10)).toBe(true);
  });
  it("tells the child it is not private", () => expect(FEEDBACK_NOT_PRIVATE).toBe("Bố mẹ sẽ đọc góp ý này."));
  it("labels every kind", () => {
    expect(FEEDBACK_LABELS).toEqual({ like: "👍 Thích", dislike: "👎 Chưa thích", idea: "💡 Ý tưởng" });
    expect(isFeedbackKind("idea")).toBe(true);
    expect(isFeedbackKind("x")).toBe(false);
  });
  it("knows when the table is not there yet (preview before merge)", () => {
    expect(tableMissing({ code: "PGRST205" })).toBe(true);
    expect(tableMissing({ code: "42P01" })).toBe(true);
    expect(tableMissing({ code: "23514" })).toBe(false);
    expect(tableMissing(null)).toBe(false);
  });
});
