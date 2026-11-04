import { describe, expect, it } from "vitest";
import { confirmRequestMessage, eveningMessage, parseSubscription, testMessage, unlockRequestMessage } from "@/lib/push/messages";

// Parent decisions 01/11/2026 (S5): push for "Xin mở trang", "Nhờ bố mẹ xem", and a 21:45
// reminder only when something waits. A push never carries the child's own words.

describe("push messages", () => {
  it("Xin mở trang: names the child and the site, opens the requests page", () => {
    expect(unlockRequestMessage("An", "zalo.me")).toEqual({
      title: "An xin mở trang",
      body: "zalo.me · chạm để duyệt",
      url: "/parent/requests",
      tag: "unlock-zalo.me",
    });
  });

  it("Nhờ bố mẹ xem: opens the requests page", () => {
    const m = confirmRequestMessage("Nguyên");
    expect(m.title).toBe("Nguyên nhờ bố mẹ xem bài");
    expect(m.url).toBe("/parent/requests");
  });

  it("evening: nothing waiting → no push", () => {
    expect(eveningMessage(0, 0)).toBeNull();
  });

  it("evening: unreviewed work opens Xem gộp", () => {
    expect(eveningMessage(3, 0)).toEqual({ title: "Xem lại ngày của con", body: "3 bài chưa xem · chạm để mở", url: "/parent/review", tag: "evening" });
  });

  it("evening: only open requests opens Con nhờ", () => {
    const m = eveningMessage(0, 2);
    expect(m?.body).toBe("2 việc con đang nhờ · chạm để mở");
    expect(m?.url).toBe("/parent/requests");
  });

  it("evening: both counts in one push", () => {
    expect(eveningMessage(1, 1)?.body).toBe("1 bài chưa xem · 1 việc con đang nhờ · chạm để mở");
  });

  it("every link stays inside the app", () => {
    for (const m of [unlockRequestMessage("A", "x.com"), confirmRequestMessage("A"), eveningMessage(1, 1)!, testMessage()]) {
      expect(m.url.startsWith("/")).toBe(true);
    }
  });
});

const p256dh = "B" + "A".repeat(86); // 87 chars = 65 bytes base64url
const auth = "A".repeat(22); // 16 bytes

describe("parseSubscription", () => {
  it("accepts a browser subscription", () => {
    expect(parseSubscription({ endpoint: "https://web.push.apple.com/abc", keys: { p256dh, auth } })).toEqual({
      endpoint: "https://web.push.apple.com/abc",
      keys: { p256dh, auth },
    });
  });

  it("accepts padded base64", () => {
    expect(parseSubscription({ endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: p256dh + "=", auth: auth + "==" } })).not.toBeNull();
  });

  it.each([
    ["not an object", "x"],
    ["http endpoint", { endpoint: "http://push.example.com/x", keys: { p256dh, auth } }],
    ["bad url", { endpoint: "not a url", keys: { p256dh, auth } }],
    ["missing keys", { endpoint: "https://push.example.com/x" }],
    ["short p256dh", { endpoint: "https://push.example.com/x", keys: { p256dh: "abc", auth } }],
    ["bad characters", { endpoint: "https://push.example.com/x", keys: { p256dh: p256dh.replace("A", "+"), auth } }],
    ["huge endpoint", { endpoint: "https://push.example.com/" + "x".repeat(1100), keys: { p256dh, auth } }],
  ])("refuses %s", (_name, input) => {
    expect(parseSubscription(input)).toBeNull();
  });
});
