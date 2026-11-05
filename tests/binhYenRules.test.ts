import { describe, expect, it } from "vitest";
import { settingsSchema, settingsToRow } from "@/lib/admin/schemas";
import { whoSeesWhat } from "@/lib/binhYen/copy";
import {
  ESCALATE_AFTER_MINUTES,
  NOT_DELIVERED_TEXT,
  OFFLINE_TEXT,
  byPinProblem,
  byWrongPinMessage,
  escalationTarget,
  isSignalKind,
  pinWipedNotice,
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

describe("Góc bình yên PIN (R6, Q1)", () => {
  it("accepts 6 digits typed twice, different from the login PIN", () => {
    expect(byPinProblem("482917", "482917", false)).toBeNull();
  });
  it("refuses easy PINs like the login PIN rules do", () => {
    expect(byPinProblem("111111", "111111", false)).toMatch(/dễ đoán/);
    expect(byPinProblem("123456", "123456", false)).toMatch(/dễ đoán/);
    expect(byPinProblem("12345", "12345", false)).toMatch(/6 chữ số/);
  });
  it("refuses two different entries", () => {
    expect(byPinProblem("482917", "482918", false)).toMatch(/chưa giống/);
  });
  it("refuses the login PIN (the parents know it)", () => {
    expect(byPinProblem("482917", "482917", true)).toMatch(/giống PIN đăng nhập/);
  });
  it("counts down tries, then locks for 15 minutes", () => {
    expect(byWrongPinMessage(1)).toBe("PIN chưa đúng. Còn 4 lần thử.");
    expect(byWrongPinMessage(4)).toBe("PIN chưa đúng. Còn 1 lần thử.");
    expect(byWrongPinMessage(5)).toBe("Sai 5 lần. Đợi 15 phút rồi thử lại.");
  });
  it("tells the child when and that the private text went with it", () => {
    const n = pinWipedNotice("2026-11-05T12:05:00Z");
    expect(n).toContain("vừa được bố mẹ xóa lúc 19:05 ngày 05/11");
    expect(n).toContain("đã được xóa");
  });
});

describe("Góc bình yên session (idle lock on the server clock)", () => {
  const open = (lastSeenMin: number, startedMin = 30) => ({ started_at: minutesAgo(startedMin), last_seen_at: minutesAgo(lastSeenMin), ended_at: null });
  it("no session → closed", () => expect(sessionVerdict(null, NOW, 5, null)).toBe("none"));
  it("touched 4 minutes ago with a 5-minute lock → open", () => expect(sessionVerdict(open(4), NOW, 5, null)).toBe("open"));
  it("exactly 5 minutes → still open; 5 min 1 s → idle", () => {
    expect(sessionVerdict(open(5), NOW, 5, null)).toBe("open");
    expect(sessionVerdict({ ...open(5), last_seen_at: new Date(NOW.getTime() - 5 * 60_000 - 1000).toISOString() }, NOW, 5, null)).toBe("idle");
  });
  it("6 minutes away (e.g. iPad in the background) → PIN again (spike S1)", () => expect(sessionVerdict(open(6), NOW, 5, null)).toBe("idle"));
  it("the family's own idle setting decides (15 minutes)", () => expect(sessionVerdict(open(10), NOW, 15, null)).toBe("open"));
  it("locked by hand → closed", () => expect(sessionVerdict({ ...open(1), ended_at: minutesAgo(0) }, NOW, 5, null)).toBe("ended"));
  it("a parent wiped the PIN after it opened → closed", () => expect(sessionVerdict(open(1, 10), NOW, 5, minutesAgo(5))).toBe("wiped"));
  it("a wipe BEFORE the session (new PIN set since) does not close it", () => expect(sessionVerdict(open(1, 10), NOW, 5, minutesAgo(20))).toBe("open"));
  it("the laptop clock plays no part: only `now` from the server counts", () => {
    expect(sessionVerdict(open(1), at("2030-01-01T00:00:00Z"), 5, null)).toBe("idle");
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

describe("escalation after 10 minutes unseen (Q5)", () => {
  it("9 minutes → not yet", () => expect(shouldEscalate(signal({ created_at: minutesAgo(9) }), NOW)).toBe(false));
  it(`${ESCALATE_AFTER_MINUTES} minutes unseen → re-push`, () => expect(shouldEscalate(signal({ created_at: minutesAgo(10) }), NOW)).toBe(true));
  it("seen → never", () => expect(shouldEscalate(signal({ created_at: minutesAgo(30), seen_at: minutesAgo(20) }), NOW)).toBe(false));
  it("only once", () => expect(shouldEscalate(signal({ created_at: minutesAgo(30), escalated_at: minutesAgo(15) }), NOW)).toBe(false));
  it("not a forgotten one from yesterday", () => expect(shouldEscalate(signal({ created_at: minutesAgo(7 * 60) }), NOW)).toBe(false));
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
      text: "Chưa ai thấy. Con hãy tìm bố mẹ trực tiếp hoặc gọi 111 (miễn phí, 24/7).",
    });
  });
  it("an old signal is not shown any more", () => expect(talkStatus(signal({ created_at: minutesAgo(4 * 60) }), NOW)).toBeNull());
  it("never fails silently: not delivered / offline both point to a parent and 111", () => {
    expect(NOT_DELIVERED_TEXT).toContain("111");
    expect(OFFLINE_TEXT).toContain("111");
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

describe("“🔒 Ai thấy gì?” tells the truth (§3)", () => {
  const text = whoSeesWhat(5).join("\n");
  it.each([
    ["parents do not see content", "Bố mẹ không xem được cảm xúc"],
    ["want_talk is a signal", "Con muốn nói chuyện"],
    ["unsafe writing will signal, without text", "không kèm chữ"],
    ["text stays on the laptop", "chỉ nằm trên laptop của con"],
    ["the PIN's honest limit", "không chặn được người rành máy tính"],
    ["admins can technically open tables", "Về kỹ thuật"],
    ["a wipe deletes the text and the child is told", "con sẽ được báo"],
    ["the idle lock uses the family setting", "tự khóa sau 5 phút"],
  ])("%s", (_label, phrase) => expect(text).toContain(phrase));
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
