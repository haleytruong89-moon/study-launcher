/**
 * Ôn tập trong Launcher (SQL 0029): the review apps made in Xưởng ôn tập — one self-contained
 * .html file each — served at /on-tap/<slug> from the private `study-apps` bucket.
 * Pure helpers only (no I/O), so they are unit-tested (tests/studyApps.test.ts).
 */

/** Same rule as the `study_apps_slug_format` check of 0029. */
export const STUDY_APP_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,47}$/;

/**
 * Upload limit: 4 MB, under Vercel's 4.5 MB request body limit (the bucket of 0029 allows 5 MB).
 * The biggest app today is about 250 KB.
 */
export const STUDY_APP_MAX_BYTES = 4 * 1024 * 1024;

export const STUDY_APP_TITLE_MAX = 80;

export function isValidStudyAppSlug(slug: string): boolean {
  return STUDY_APP_SLUG_RE.test(slug);
}

/** "Lập phương trình Toán 9" → "lap-phuong-trinh-toan-9" (Vietnamese marks and đ removed). */
export function slugifyStudyApp(title: string): string {
  const s = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return s.length >= 2 ? s : "";
}

/**
 * The file must be an HTML page, not just any bytes the browser could sniff into something else:
 * after an optional BOM, whitespace and comments, it starts with a doctype or an <html> tag.
 */
export function looksLikeHtmlPage(text: string): boolean {
  const head = text.slice(0, 4096).replace(/^﻿/, "").replace(/^(\s|<!--[\s\S]*?-->)+/, "");
  return /^<!doctype\s+html[\s>]/i.test(head) || /^<html[\s>]/i.test(head);
}

/** Storage path of a new upload: {family}/{slug}-{random}.html (a new path on every replace). */
export function studyAppPath(familyId: string, slug: string, random: string): string {
  const r = random.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  return `${familyId}/${slug}-${r}.html`;
}

/** True when a stored path belongs to this family's folder of the bucket. */
export function isStudyAppPathOf(path: string, familyId: string): boolean {
  const [family, name, ...rest] = path.split("/");
  return rest.length === 0 && family === familyId && !!name && /^[a-z0-9-]+\.html$/.test(name);
}

/**
 * Content-Security-Policy of an app page. The app runs on the Launcher's own address, so it gets
 * NO network at all (no fetch, no images or fonts from other sites, no forms): its own inline
 * script and styles, data:/blob: pictures, and nothing else. Never framed by another site.
 */
export const STUDY_APP_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "connect-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "manifest-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

/** Response headers of an app page (also set for /on-tap/:slug in next.config.ts). */
export const STUDY_APP_HEADERS: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": STUDY_APP_CSP,
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  // A replaced app must show at once; the file is small.
  "Cache-Control": "private, no-store",
};

/** The address to paste into a supplementary task's Link: https://<launcher>/on-tap/<slug>. */
export function studyAppUrl(appUrl: string | undefined, slug: string): string {
  const base = (appUrl ?? "").replace(/\/+$/, "");
  return `${base}/on-tap/${slug}`;
}
