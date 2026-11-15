/**
 * Gia sư AI Toán (repo gia-su-ai-math) under this site's address (D20, 14/11/2026): next.config.ts
 * rewrites /gia-su/* to the tutor app, so both share the session cookie and the child never signs
 * in twice. Two doors in Góc học tập (parent decision 14/11/2026): the "Cô gia sư Toán" card, and
 * "Em kẹt bài này? Hỏi cô" in the work panel when the task is Maths. PURE (server + browser).
 * Without TUTOR_APP_ORIGIN nothing changes: no rewrite, no card, no button.
 */

/** The tutor app's https origin from TUTOR_APP_ORIGIN, or null. http://localhost only in dev. */
export function tutorOrigin(raw: string | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  const devLocal = process.env.NODE_ENV !== "production" && url.protocol === "http:" && url.hostname === "localhost";
  if (url.protocol !== "https:" && !devLocal) return null;
  return url.origin;
}

/** Tutor v1 teaches grade 6 and grade 9 only (DOMAIN of gia-su-ai). */
export function tutorEnabled(origin: string | null, grade: number | null): boolean {
  return origin !== null && (grade === 6 || grade === 9);
}

/** "Toán", "toán", "Toan", "Toán học", "Toán 9"… (subject is free text, lib/subjects.ts). */
export function isMathSubject(subject: string | null | undefined): boolean {
  if (!subject) return false;
  const plain = subject.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").trim().toLowerCase();
  return /^toan(?![a-z])/.test(plain);
}

export const TUTOR_HOME = "/gia-su?from=hoc-tap";
const TITLE_MAX = 120;

/** Opens the tutor from a task; the title is only shown there (not sent to the AI, not stored). */
export function tutorTaskHref(title: string): string {
  return `${TUTOR_HOME}&task=${encodeURIComponent(title.slice(0, TITLE_MAX))}`;
}

export function tutorRewrites(origin: string | null): { source: string; destination: string }[] {
  if (!origin) return [];
  return [
    { source: "/gia-su", destination: `${origin}/gia-su` },
    { source: "/gia-su/:path*", destination: `${origin}/gia-su/:path*` },
  ];
}
