import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

type Rule = { source: string; headers: { key: string; value: string }[] };

/** Enough of Next's matcher for the patterns used in next.config.ts ("/x/:path*" also matches "/x"). */
function matches(source: string, path: string): boolean {
  const pattern = source
    .split("/:path*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("(?:/.*)?");
  return new RegExp(`^${pattern === "" ? "(?:/.*)?" : pattern}$`).test(path);
}

/** Headers a path gets: every matching rule applies, the later rule wins for the same key. */
async function effective(path: string): Promise<Map<string, string>> {
  const rules = (await nextConfig.headers!()) as Rule[];
  const out = new Map<string, string>();
  for (const rule of rules) {
    if (!matches(rule.source, path)) continue;
    for (const h of rule.headers) out.set(h.key.toLowerCase(), h.value);
  }
  return out;
}

describe("security headers", () => {
  it.each(["/", "/today", "/parent/settings", "/api/today"])("app-wide headers on %s", async (path) => {
    const h = await effective(path);
    expect(h.get("x-content-type-options")).toBe("nosniff");
    expect(h.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(h.get("x-frame-options")).toBe("DENY");
    expect(h.get("content-security-policy")).toBe("frame-ancestors 'none'");
    const pp = h.get("permissions-policy") ?? "";
    for (const feature of ["geolocation=()", "microphone=()", "payment=()", "usb=()"]) expect(pp).toContain(feature);
    expect(pp).not.toContain("camera"); // proof photos: keep the camera usable
  });

  it.each(["/binh-yen", "/binh-yen/anything"])("Góc bình yên keeps its stricter headers on %s", async (path) => {
    const h = await effective(path);
    expect(h.get("referrer-policy")).toBe("no-referrer");
    expect(h.get("cache-control")).toBe("no-store");
    const csp = h.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(h.get("x-content-type-options")).toBe("nosniff");
    expect(h.get("x-frame-options")).toBe("DENY");
  });

  it("service worker keeps no-cache", async () => {
    const h = await effective("/sw.js");
    expect(h.get("cache-control")).toBe("no-cache, no-store, must-revalidate");
    expect(h.get("service-worker-allowed")).toBe("/");
  });

  it("the app-wide rule comes before every specific rule (later rules win)", async () => {
    const rules = (await nextConfig.headers!()) as Rule[];
    expect(rules[0]?.source).toBe("/:path*");
  });
});
