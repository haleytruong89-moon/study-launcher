import { describe, expect, it } from "vitest";
import { REQUEST_URL_MAX, requestSchema, requestUrl } from "@/lib/admin/allowlist";
import { deviceWord, familyDevices } from "@/lib/push/devices";
import { unlockReminderMessage } from "@/lib/push/messages";
import { REMIND_AFTER_MINUTES, remindDue } from "@/lib/push/remind";

describe("Xin mở trang: long addresses (25/11/2026)", () => {
  it("keeps a normal address as it is", () => {
    expect(requestUrl("https://meet.google.com/abc-defg-hij?authuser=1")).toBe("https://meet.google.com/abc-defg-hij?authuser=1");
  });
  it("cuts a very long address to its site and page instead of refusing it", () => {
    const long = `https://www.google.com/url?q=${"a".repeat(3000)}#x`;
    expect(requestSchema.safeParse({ url: long }).success).toBe(true);
    expect(requestUrl(long)).toBe("https://www.google.com/url");
    const longPath = `https://a.vn/${"p".repeat(3000)}`;
    expect(requestUrl(longPath)!.length).toBe(REQUEST_URL_MAX);
  });
  it("refuses what is not a web page", () => {
    expect(requestUrl("javascript:alert(1)")).toBeNull();
    expect(requestUrl("file:///C:/a.pdf")).toBeNull();
    expect(requestUrl("not a url")).toBeNull();
  });
});

describe("Xin mở trang: telling the parents again", () => {
  const now = new Date("2026-11-25T13:30:00Z");
  it("tells again only after 10 minutes", () => {
    expect(REMIND_AFTER_MINUTES).toBe(10);
    expect(remindDue("2026-11-25T13:25:00Z", now)).toBe(false);
    expect(remindDue("2026-11-25T13:20:00Z", now)).toBe(true);
    expect(remindDue("2026-11-20T08:00:00Z", now)).toBe(true);
    expect(remindDue(null, now)).toBe(true);
    expect(remindDue("garbage", now)).toBe(true);
  });
  it("the reminder says the child is still waiting, never the child's own words", () => {
    const m = unlockReminderMessage("Nguyên", "classroom.google.com");
    expect(m.title).toBe("Nguyên vẫn đang chờ: xin mở trang");
    expect(m.body).toBe("classroom.google.com · chạm để duyệt");
    expect(m.url).toBe("/parent/requests");
  });
});

describe("Thông báo: the family's phones", () => {
  it("names the kind of device from the browser", () => {
    expect(deviceWord("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit")).toBe("iPhone");
    expect(deviceWord("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe("Điện thoại Android");
    expect(deviceWord("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("Máy Windows");
    expect(deviceWord(null)).toBe("Một máy");
  });
  it("shows a parent with no phone as an empty list", () => {
    const fam = familyDevices(
      [
        { id: "b", display_name: "Bố" },
        { id: "m", display_name: "Mẹ" },
      ],
      [{ profile_id: "b", user_agent: "iPhone", created_at: "2026-11-07T02:00:00Z" }],
      (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7),
    );
    expect(fam).toEqual([
      { name: "Bố", devices: [{ word: "iPhone", since: "07/11" }] },
      { name: "Mẹ", devices: [] },
    ]);
  });
});
