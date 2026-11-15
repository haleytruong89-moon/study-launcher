import { afterEach, describe, expect, it, vi } from "vitest";
import { isMathSubject, TUTOR_HOME, tutorEnabled, tutorOrigin, tutorRewrites, tutorTaskHref } from "@/lib/tutor/entry";
import nextConfig from "@/next.config";

afterEach(() => vi.unstubAllEnvs());

describe("tutorOrigin (TUTOR_APP_ORIGIN, D20)", () => {
  it("keeps only the https origin", () => {
    expect(tutorOrigin("https://gia-su-ai.vercel.app/")).toBe("https://gia-su-ai.vercel.app");
    expect(tutorOrigin("https://gia-su-ai.vercel.app/gia-su")).toBe("https://gia-su-ai.vercel.app");
  });
  it("refuses empty, non-https and odd values", () => {
    for (const v of [undefined, "", "  ", "http://x.example", "javascript:alert(1)", "gia-su-ai.vercel.app", "https://u:p@x.example"])
      expect(tutorOrigin(v), String(v)).toBeNull();
  });
  it("allows http://localhost outside production (local dev)", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(tutorOrigin("http://localhost:3001")).toBe("http://localhost:3001");
    vi.stubEnv("NODE_ENV", "production");
    expect(tutorOrigin("http://localhost:3001")).toBeNull();
  });
});

describe("tutorEnabled", () => {
  it("needs the origin and a grade-6 or grade-9 child", () => {
    expect(tutorEnabled("https://t.example", 9)).toBe(true);
    expect(tutorEnabled("https://t.example", 6)).toBe(true);
    expect(tutorEnabled("https://t.example", 7)).toBe(false);
    expect(tutorEnabled("https://t.example", null)).toBe(false);
    expect(tutorEnabled(null, 9)).toBe(false);
  });
});

describe("isMathSubject (subject is free text the parent typed)", () => {
  it.each(["Toán", "toán", "TOÁN", "Toan", " Toán học", "Toán 9", "toán-hình"])("%s is maths", (s) => expect(isMathSubject(s)).toBe(true));
  it.each(["Tin học", "Ngữ văn", "Tiếng Anh", "KHTN", "", null, undefined])("%s is not maths", (s) => expect(isMathSubject(s)).toBe(false));
});

describe("links", () => {
  it("home and task links stay on this site and say where they came from", () => {
    expect(TUTOR_HOME).toBe("/gia-su?from=hoc-tap");
    expect(tutorTaskHref("Bài 3 & 4")).toBe("/gia-su?from=hoc-tap&task=B%C3%A0i%203%20%26%204");
  });
  it("a long title is cut to 120 characters", () => {
    expect(decodeURIComponent(tutorTaskHref("a".repeat(300)).split("task=")[1] ?? "")).toHaveLength(120);
  });
});

describe("rewrite /gia-su → the tutor app", () => {
  it("nothing without an origin", () => {
    expect(tutorRewrites(null)).toEqual([]);
  });
  it("both /gia-su and everything under it", () => {
    expect(tutorRewrites("https://t.example")).toEqual([
      { source: "/gia-su", destination: "https://t.example/gia-su" },
      { source: "/gia-su/:path*", destination: "https://t.example/gia-su/:path*" },
    ]);
  });
  it("next.config reads TUTOR_APP_ORIGIN", async () => {
    vi.stubEnv("TUTOR_APP_ORIGIN", "");
    expect(await nextConfig.rewrites!()).toEqual([]);
    vi.stubEnv("TUTOR_APP_ORIGIN", "https://t.example/");
    expect(await nextConfig.rewrites!()).toHaveLength(2);
  });
});
