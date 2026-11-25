import { describe, expect, it } from "vitest";
import {
  STUDY_APP_CSP,
  STUDY_APP_HEADERS,
  isStudyAppPathOf,
  isValidStudyAppSlug,
  looksLikeHtmlPage,
  slugifyStudyApp,
  studyAppPath,
  studyAppUrl,
} from "@/lib/studyApps";

const FAMILY = "10000000-0000-0000-0000-00000000000a";

describe("slugifyStudyApp", () => {
  it("drops Vietnamese marks and đ", () => {
    expect(slugifyStudyApp("Lập phương trình Toán 9")).toBe("lap-phuong-trinh-toan-9");
    expect(slugifyStudyApp("Hệ thức lượng trong tam giác vuông")).toBe("he-thuc-luong-trong-tam-giac-vuong");
    expect(slugifyStudyApp("Đơn 1 · Số nguyên")).toBe("don-1-so-nguyen");
  });
  it("gives a valid slug or nothing", () => {
    expect(isValidStudyAppSlug(slugifyStudyApp("Ước và bội (Bài 8)"))).toBe(true);
    expect(slugifyStudyApp("!!")).toBe("");
    expect(slugifyStudyApp("a")).toBe("");
    const long = slugifyStudyApp("ôn tập ".repeat(20));
    expect(long.length).toBeLessThanOrEqual(48);
    expect(isValidStudyAppSlug(long)).toBe(true);
  });
});

describe("isValidStudyAppSlug", () => {
  it("matches the SQL rule", () => {
    expect(isValidStudyAppSlug("lap-pt")).toBe(true);
    expect(isValidStudyAppSlug("9a")).toBe(true);
    expect(isValidStudyAppSlug("-lap")).toBe(false);
    expect(isValidStudyAppSlug("Lap")).toBe(false);
    expect(isValidStudyAppSlug("a")).toBe(false);
    expect(isValidStudyAppSlug("a/b")).toBe(false);
    expect(isValidStudyAppSlug("a".repeat(49))).toBe(false);
  });
});

describe("looksLikeHtmlPage", () => {
  it("accepts real pages", () => {
    expect(looksLikeHtmlPage("<!doctype html><html>")).toBe(true);
    expect(looksLikeHtmlPage("﻿\n  <!DOCTYPE html>\n<html lang=vi>")).toBe(true);
    expect(looksLikeHtmlPage("<!-- app -->\n<html>")).toBe(true);
  });
  it("refuses anything else", () => {
    expect(looksLikeHtmlPage("%PDF-1.7")).toBe(false);
    expect(looksLikeHtmlPage("<svg xmlns=...>")).toBe(false);
    expect(looksLikeHtmlPage("hello <html>")).toBe(false);
    expect(looksLikeHtmlPage("")).toBe(false);
  });
});

describe("paths", () => {
  it("builds a fresh path inside the family folder", () => {
    const p = studyAppPath(FAMILY, "lap-pt", "A1b2-C3d4E5f6G7");
    expect(p).toBe(`${FAMILY}/lap-pt-a1b2c3d4e5f6.html`);
    expect(isStudyAppPathOf(p, FAMILY)).toBe(true);
  });
  it("refuses another family or a nested path", () => {
    const p = studyAppPath(FAMILY, "lap-pt", "x1");
    expect(isStudyAppPathOf(p, "10000000-0000-0000-0000-00000000000b")).toBe(false);
    expect(isStudyAppPathOf(`${FAMILY}/a/b.html`, FAMILY)).toBe(false);
    expect(isStudyAppPathOf(`${FAMILY}/b.js`, FAMILY)).toBe(false);
  });
});

describe("headers", () => {
  it("gives the app no network and no framing", () => {
    expect(STUDY_APP_CSP).toContain("connect-src 'none'");
    expect(STUDY_APP_CSP).toContain("default-src 'none'");
    expect(STUDY_APP_CSP).toContain("frame-ancestors 'none'");
    expect(STUDY_APP_CSP).toContain("form-action 'none'");
    expect(STUDY_APP_CSP).not.toMatch(/https?:/);
    expect(STUDY_APP_CSP).not.toContain("unsafe-eval");
    expect(STUDY_APP_HEADERS["Cache-Control"]).toContain("no-store");
    expect(STUDY_APP_HEADERS["X-Robots-Tag"]).toContain("noindex");
  });
});

describe("studyAppUrl", () => {
  it("joins the launcher address and the slug", () => {
    expect(studyAppUrl("https://launcher.example.com/", "lap-pt")).toBe("https://launcher.example.com/on-tap/lap-pt");
    expect(studyAppUrl(undefined, "lap-pt")).toBe("/on-tap/lap-pt");
  });
});
