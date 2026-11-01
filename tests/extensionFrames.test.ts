import { describe, expect, it } from "vitest";
import { frameReport, siteOf } from "@/extension/src/core/frames";
import type { EffectiveState } from "@/extension/src/core/sync";

const locked: EffectiveState = {
  locked: true,
  reason: "server-locked",
  allow: ["meet.google.com", "accounts.google.com", "math-app-gules.vercel.app"],
  blockAlways: ["translate.goog"],
  launcherUrl: "https://study-launcher.vercel.app",
  launcherHost: "study-launcher.vercel.app",
  openUntil: null,
  failures: 0,
  allowLocalFiles: false,
};

describe("blocked-frame report", () => {
  it("finds the registrable site", () => {
    expect(siteOf("meet.google.com")).toBe("google.com");
    expect(siteOf("google.com")).toBe("google.com");
    expect(siteOf("thcs.hanoi.edu.vn")).toBe("hanoi.edu.vn");
  });

  it("reports a same-site frame blocked inside an allowed page", () => {
    expect(frameReport(locked, "https://meet.google.com", "https://ogs.google.com/widget/app?x=1")).toEqual({
      page: "https://meet.google.com",
      frame: "https://ogs.google.com/widget/app?x=1",
      frameHost: "ogs.google.com",
    });
  });

  it("stays quiet otherwise", () => {
    // Ads / other sites inside a study page.
    expect(frameReport(locked, "https://meet.google.com", "https://ads.doubleclick.net/x")).toBeNull();
    // The page itself is not a study page.
    expect(frameReport(locked, "https://www.example.com", "https://sub.example.com/x")).toBeNull();
    // Already allowed, always blocked, open laptop, or no page.
    expect(frameReport(locked, "https://meet.google.com", "https://accounts.google.com/x")).toBeNull();
    expect(frameReport({ ...locked, allow: [...locked.allow, "x.translate.goog"] }, "https://x.translate.goog", "https://y.translate.goog/")).toBeNull();
    expect(frameReport({ ...locked, locked: false }, "https://meet.google.com", "https://ogs.google.com/")).toBeNull();
    expect(frameReport(locked, undefined, "https://ogs.google.com/")).toBeNull();
    expect(frameReport(locked, "https://meet.google.com", "data:text/html,x")).toBeNull();
  });
});
