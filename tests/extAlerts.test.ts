import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { tokenProof, toHex, uninstallUrl, UNINSTALL_URL_MAX } from "@/extension/src/core/uninstall";
import { EXT_MISSING, EXT_UNINSTALLED, lastExtEvents, parseProof, quietOver, UNINSTALL_QUIET_MS, whenText } from "@/lib/ext/alerts";
import { desktopBrowser } from "@/lib/ext/browser";
import { extensionMissingMessage, extensionRemovedMessage } from "@/lib/push/messages";

// S6 (01/11/2026): tell the parents when the extension is removed, or when the child opens the
// Launcher on a desktop Chrome / Edge without it. A laptop that is switched off is never an alert.

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde";
const LAUNCHER = "https://study-launcher.vercel.app";

describe("extension uninstall address", () => {
  it("proof = SHA-256 hex of the token, exactly like the server's token_hash", async () => {
    expect(await tokenProof(TOKEN)).toBe(createHash("sha256").update(TOKEN).digest("hex"));
  });

  it("never contains the token itself", async () => {
    const url = uninstallUrl(LAUNCHER, await tokenProof(TOKEN));
    expect(url).toMatch(/^https:\/\/study-launcher\.vercel\.app\/api\/ext\/uninstalled\?k=[0-9a-f]{64}$/);
    expect(url).not.toContain(TOKEN);
    expect(url.length).toBeLessThanOrEqual(UNINSTALL_URL_MAX);
  });

  it("not paired or a bad proof -> empty (the browser opens nothing)", () => {
    expect(uninstallUrl(LAUNCHER, null)).toBe("");
    expect(uninstallUrl(LAUNCHER, TOKEN)).toBe("");
    expect(uninstallUrl(LAUNCHER, "A".repeat(64))).toBe("");
  });

  it("only https, or a local test server; keeps only the origin", () => {
    const p = "a".repeat(64);
    expect(uninstallUrl("http://evil.example", p)).toBe("");
    expect(uninstallUrl("not a url", p)).toBe("");
    expect(uninstallUrl("http://localhost:3100", p)).toBe(`http://localhost:3100/api/ext/uninstalled?k=${p}`);
    expect(uninstallUrl(`${LAUNCHER}/today?x=1`, p)).toBe(`${LAUNCHER}/api/ext/uninstalled?k=${p}`);
  });

  it("toHex pads every byte", () => {
    expect(toHex(new Uint8Array([0, 1, 15, 16, 255]))).toBe("00010f10ff");
  });
});

describe("server checks", () => {
  it("parseProof accepts only 64 lowercase hex", () => {
    const h = createHash("sha256").update(TOKEN).digest("hex");
    expect(parseProof(h)).toBe(h);
    expect(parseProof(h.toUpperCase())).toBeNull();
    expect(parseProof(TOKEN)).toBeNull();
    expect(parseProof(h + "0")).toBeNull();
    expect(parseProof(null)).toBeNull();
  });

  it("uninstall alerts at most once an hour per laptop", () => {
    const now = new Date("2026-11-01T13:00:00Z");
    expect(quietOver(null, now, UNINSTALL_QUIET_MS)).toBe(true);
    expect(quietOver("2026-11-01T12:30:00Z", now, UNINSTALL_QUIET_MS)).toBe(false);
    expect(quietOver("2026-11-01T12:00:00Z", now, UNINSTALL_QUIET_MS)).toBe(true);
  });
});

describe("desktopBrowser: only desktop Chrome / Edge can have the extension", () => {
  const cases: [string, string, string | null][] = [
    ["Edge on Windows", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0", "Edge"],
    ["Chrome on Windows", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", "Chrome"],
    ["Chrome on Mac", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", "Chrome"],
    ["Cốc Cốc", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) coc_coc_browser/130.0.0 Chrome/124.0.0.0 Safari/537.36", "Cốc Cốc"],
    ["Opera", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0", "Opera"],
    ["headless test browser", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36", "Chrome"],
    ["iPad Safari (asks for the desktop site)", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", null],
    ["iPhone Safari", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", null],
    ["Chrome on iPad", "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1", null],
    ["Edge on iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/130.0 Mobile/15E148 Safari/605.1.15", null],
    ["Chrome on Android", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36", null],
    ["Firefox on Windows", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0", null],
  ];
  it.each(cases)("%s", (_name, ua, expected) => {
    expect(desktopBrowser(ua)).toBe(expected);
  });
  it("empty / missing", () => {
    expect(desktopBrowser("")).toBeNull();
    expect(desktopBrowser(null)).toBeNull();
  });
});

describe("Devices page summary", () => {
  it("keeps the latest event per laptop and per child, any order", () => {
    const rows = [
      { action: EXT_UNINSTALLED, actor_id: "kid-1", payload: { device_id: "dev-1" }, created_at: "2026-11-01T10:00:00Z" },
      { action: EXT_UNINSTALLED, actor_id: "kid-1", payload: { device_id: "dev-1" }, created_at: "2026-11-01T12:00:00Z" },
      { action: EXT_MISSING, actor_id: "kid-2", payload: { browser: "Edge" }, created_at: "2026-10-30T12:00:00Z" },
      { action: EXT_MISSING, actor_id: "kid-2", payload: { browser: "Chrome" }, created_at: "2026-11-01T01:00:00Z" },
      { action: EXT_UNINSTALLED, actor_id: "kid-1", payload: {}, created_at: "2026-11-01T13:00:00Z" },
      { action: "device.pair", actor_id: "kid-1", payload: { device_id: "dev-1" }, created_at: "2026-11-01T14:00:00Z" },
    ];
    const last = lastExtEvents(rows);
    expect(last.uninstalled.get("dev-1")).toEqual({ at: "2026-11-01T12:00:00Z" });
    expect(last.uninstalled.size).toBe(1);
    expect(last.missing.get("kid-2")).toEqual({ at: "2026-11-01T01:00:00Z", browser: "Chrome" });
  });

  it("times are shown in Vietnam time", () => {
    const now = new Date("2026-11-01T14:00:00Z"); // 21:00 in Hà Nội
    expect(whenText("2026-11-01T13:15:00Z", now)).toBe("hôm nay 20:15");
    expect(whenText("2026-10-31T16:30:00Z", now)).toBe("hôm qua 23:30");
    expect(whenText("2026-10-28T01:05:00Z", now)).toBe("28/10 08:05");
  });
});

describe("push wording", () => {
  it("extension removed: names the child and the laptop, opens Devices", () => {
    expect(extensionRemovedMessage("An", "Laptop An", "dev-1")).toEqual({
      title: "Extension trên laptop của An vừa bị gỡ",
      body: "Laptop An · web trên máy này không còn bị khóa · chạm để xem",
      url: "/parent/devices",
      tag: "ext-removed-dev-1",
    });
  });
  it("Launcher without the extension: names the child and the browser", () => {
    expect(extensionMissingMessage("An", "Edge", "kid-1")).toEqual({
      title: "An đang mở Study Launcher trên một trình duyệt không có extension",
      body: "Edge trên máy tính · chạm để xem cách xử lý",
      url: "/parent/devices",
      tag: "ext-missing-kid-1",
    });
  });
});
