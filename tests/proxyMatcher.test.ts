import { describe, expect, it } from "vitest";
import { config } from "@/proxy";

// Next.js applies the matcher as a full-path regular expression.
const re = new RegExp(`^${config.matcher[0]}$`);

describe("proxy matcher", () => {
  it("refreshes the session for pages", () => {
    for (const p of ["/", "/today", "/parent", "/binh-yen", "/login", "/blocked"]) expect(re.test(p), p).toBe(true);
  });
  it("skips API routes, static files and the extension download", () => {
    for (const p of ["/api/today", "/api/ext/state", "/api/tasks/start", "/_next/static/x.js", "/sw.js", "/downloads/study-launcher-extension.zip"])
      expect(re.test(p), p).toBe(false);
  });
  it("skips the tutor app under /gia-su (it refreshes the session itself, D20)", () => {
    for (const p of ["/gia-su", "/gia-su/", "/gia-su/hoi/abc", "/gia-su/api/turn", "/gia-su/_next/static/x.js"]) expect(re.test(p), p).toBe(false);
    expect(re.test("/giasu")).toBe(true);
  });
});
