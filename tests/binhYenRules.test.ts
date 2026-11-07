import { describe, expect, it } from "vitest";
import { settingsSchema, settingsToRow } from "@/lib/admin/schemas";
import { whoSeesWhat } from "@/lib/binhYen/copy";
import {
  ESCALATE_AFTER_MINUTES,
  NOT_DELIVERED_TEXT,
  OFFLINE_TEXT,
  VISIT_GAP_MINUTES,
  escalationTarget,
  isSignalKind,
  rateLimited,
  sessionVerdict,
  shouldEscalate,
  talkAvailable,
  talkStatus,
  type SignalRow,
} from "@/lib/binhYen/rules";
import { wantTalkMessage, wantTalkReminderMessage } from "@/lib/push/messages";

// Góc bình yên S-BY0 (docs/BINH_YEN.md R3, R6, §4, §6; parent decisions Q1–Q7, 01/11/2026).

const at = (iso: string) => new Date(iso);
const NOW = at("2026-11-05T12:00:00Z"); // 19:00 in Viet Nam
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

describe("Góc bình yên visit (no PIN, no idle lock — parent decision 07/11/2026)", () => {
  const open = (lastSeenMin: number, startedMin = 30) => ({ started_at: minutesAgo(startedMin), last_seen_at: minutesAgo(lastSeenMin), ended_at: null });
  it("no visit yet → none (the screen opens one)", () => expect(sessionVerdict(null, NOW)).toBe("none"));
  it("the screen said it is still there a minute ago → the visit goes on", () => expect(sessionVerdict(open(1), NOW)).toBe("open"));
  it("the gap is 5 minutes: exactly 5 → still the same visit; 5 min 1 s → the child left", () => {
    expect(VISIT_GAP_MINUTES).toBe(5);
    expect(sessionVerdict(open(5), NOW)).toBe("open");
    expect(sessionVerdict({ ...open(5), last_seen_at: new Date(NOW.getTime() - 5 * 60_000 - 1000).toISOString() }, NOW)).toBe("stale");
  });
  it("a visit from this afternoon never counts for tonight's study-time limit", () => expect(sessionVerdict(open(300, 305), NOW)).toBe("stale"));
  it("ended (study-time limit, or replaced) → ended", () => expect(sessionVerdict({ ...open(1), ended_at: minutesAgo(0) }, NOW)).toBe("ended"));
  it("the laptop clock plays no part: only `now` from the server counts", () => {
    expect(sessionVerdict(open(1), at("2030-01-01T00:00:00Z"))).toBe("stale");
  });
});

const signal = (over: Partial<SignalRow> = {}): SignalRow => ({
  id: "s1",
  kind: "want_talk",
  to_parent_id: null,
  created_at: minutesAgo(1),
  seen_at: null,
  seen_by: null,
  escalated_at: null,
  ...over,
});

describe("“Con muốn nói chuyện” — when the button shows", () => {
  it("only when push is set up AND a parent phone has notifications on", () => {
    expect(talkAvailable(true, 1)).toBe(true);
    expect(talkAvailable(true, 0)).toBe(false);
    expect(talkAvailable(false, 2)).toBe(false);
  });
  it("accepts only the kinds the child may send now", () => {
    expect(isSignalKind("want_talk")).toBe(true);
    expect(isSignalKind("needs_care")).toBe(false); // S-BY2, from the text boxes
    expect(isSignalKind("con buồn")).toBe(false);
  });
});

describe("rate limit: 1 per child per 2 minutes", () => {
  it("first ever → allowed", () => expect(rateLimited(null, NOW)).toBe(false));
  it("1 minute after the last → refused", () => expect(rateLimited(minutesAgo(1), NOW)).toBe(true));
  it("2 minutes after → allowed again", () => expect(rateLimited(minutesAgo(2), NOW)).toBe(false));
});

describe("re-push after 10 minutes unseen", () => {
  // Parent decision 05/11/2026: "Con muốn nói chuyện" is NEVER re-pushed; only needs_care (S-BY2).
  const care = (o: Partial<Parameters<typeof signal>[0]> = {}) => signal({ kind: "needs_care", ...o });
  it("want_talk → never re-pushed", () => expect(shouldEscalate(signal({ created_at: minutesAgo(30) }), NOW)).toBe(false));
  it("needs_care 9 minutes → not yet", () => expect(shouldEscalate(care({ created_at: minutesAgo(9) }), NOW)).toBe(false));
  it(`needs_care ${ESCALATE_AFTER_MINUTES} minutes unseen → re-push`, () => expect(shouldEscalate(care({ created_at: minutesAgo(10) }), NOW)).toBe(true));
  it("seen → never", () => expect(shouldEscalate(care({ created_at: minutesAgo(30), seen_at: minutesAgo(20) }), NOW)).toBe(false));
  it("only once", () => expect(shouldEscalate(care({ created_at: minutesAgo(30), escalated_at: minutesAgo(15) }), NOW)).toBe(false));
  it("not a forgotten one from yesterday", () => expect(shouldEscalate(care({ created_at: minutesAgo(7 * 60) }), NOW)).toBe(false));
  it("sent to both → every parent; sent to one → that parent only (child's choice, §6)", () => {
    expect(escalationTarget(signal())).toEqual({ all: true });
    expect(escalationTarget(signal({ to_parent_id: "p2" }))).toEqual({ all: false, parentId: "p2" });
    expect(escalationTarget(signal({ kind: "needs_care", to_parent_id: "p2" }))).toEqual({ all: true });
  });
});

describe("what the child sees after sending", () => {
  it("just sent", () => {
    expect(talkStatus(signal({ created_at: "2026-11-05T11:58:00Z" }), NOW)).toMatchObject({ phase: "sent", text: "Đã gửi lúc 18:58. Đợi bố mẹ thấy nhé." });
  });
  it("seen", () => {
    expect(talkStatus(signal({ seen_at: "2026-11-05T11:59:30Z", seen_by: "p1" }), NOW)?.text).toBe("Bố/mẹ đã thấy lúc 18:59. Bố/mẹ sẽ tìm con.");
  });
  it("10 minutes and nobody saw it → find a parent or call 111", () => {
    expect(talkStatus(signal({ created_at: minutesAgo(10) }), NOW)).toMatchObject({
      phase: "unseen_long",
      text: "Bố mẹ chưa thấy tin. Con tìm bố mẹ trực tiếp để nói chuyện nhé.",
    });
  });
  it("an old signal is not shown any more", () => expect(talkStatus(signal({ created_at: minutesAgo(4 * 60) }), NOW)).toBeNull());
  it("never fails silently: not delivered / offline both tell the child to find a parent (05/11/2026)", () => {
    expect(NOT_DELIVERED_TEXT).toContain("tìm bố mẹ trực tiếp");
    expect(OFFLINE_TEXT).toContain("tìm bố mẹ trực tiếp");
  });
});

describe("push to the parents: generic, no feelings", () => {
  it("names the child only and opens /parent/talk", () => {
    const m = wantTalkMessage("Nguyên");
    expect(m.title).toBe("Nguyên muốn nói chuyện với bố mẹ");
    expect(m.url).toBe("/parent/talk");
    expect(`${m.title} ${m.body}`).not.toMatch(/buồn|lo|giận|sợ|cảm xúc|khóc/i);
  });
  it("the reminder replaces the first notification (same tag)", () => {
    expect(wantTalkReminderMessage("An").tag).toBe(wantTalkMessage("An").tag);
    expect(wantTalkReminderMessage("An").title).toBe("Nhắc lại: An muốn nói chuyện với bố mẹ");
  });
});

describe("“🔒 Ai thấy gì?” tells the truth, in at most 5 short lines (§3, 07/11/2026; R2 line 5)", () => {
  const lines = whoSeesWhat();
  const text = lines.join("\n");
  it("is short", () => {
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.length).toBeLessThanOrEqual(5);
    for (const l of lines) expect(l.length).toBeLessThan(130);
  });
  it.each([
    ["no parent page for feelings or activities", "Bố mẹ không có trang nào xem cảm xúc hay hoạt động"],
    ["want_talk is a signal with name and time only", "tên con và giờ bấm"],
    ["anyone logged in as the child can open it (no PIN)", "Ai đăng nhập bằng tài khoản của con cũng vào được"],
    ["R2: feelings also show on the child's Hôm nay and Tuần, visible to anyone at the screen", "ai đứng cạnh màn hình cũng thấy được"],
    ["the child deletes; 12 months auto-delete", "lượt cũ hơn 12 tháng"],
  ])("%s", (_label, phrase) => expect(text).toContain(phrase));
  it("no longer talks about a Góc bình yên PIN or an idle lock", () => {
    expect(text).not.toMatch(/PIN|tự khóa/);
  });
});

describe("family settings for Góc bình yên (0008)", () => {
  const base = {
    breakMinutes: 10,
    freeMinutes: 45,
    extraMinMinutes: 20,
    skillMinMinutes: 20,
    passesPerWeek: 1,
    trustUpPct: 90,
    trustUpWeeks: 3,
    trustDownPct: 70,
    homeworkLookaheadDays: 1,
    photoRetentionDays: 120,
  };
  it("optional: absent before the migration, nothing written", () => {
    const row = settingsToRow(settingsSchema.parse(base));
    expect(Object.keys(row).some((k) => k.startsWith("by_"))).toBe(false);
  });
  it("writes the switch and limits", () => {
    expect(settingsToRow(settingsSchema.parse({ ...base, byEnabled: true, byStudyMinutes: 10, byIdleLockMinutes: 5 }))).toMatchObject({ by_enabled: true, by_study_minutes: 10, by_idle_lock_minutes: 5 });
  });
  it.each([
    ["idle lock below 2", { byIdleLockMinutes: 1 }],
    ["idle lock above 15", { byIdleLockMinutes: 16 }],
    ["study limit below 5", { byStudyMinutes: 4 }],
  ])("refuses %s", (_l, extra) => expect(settingsSchema.safeParse({ ...base, ...extra }).success).toBe(false));
});
