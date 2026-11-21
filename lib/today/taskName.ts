/**
 * How a task is named on the child's screens (parent comment 21/11/2026: "Practice" said nothing,
 * the subject must come first). Pure, display only.
 *
 * - Homework: its title is already the subject ("Ngữ văn").
 * - A set task (bài bổ sung / kỹ năng): "<subject> · <title>", e.g. "English · Practice"; the
 *   subject alone when the title repeats it; the title alone without a subject.
 * - "Ôn thi" (parent decision 21/11/2026): a bài bổ sung whose title starts with "Ôn thi" is an
 *   exam-prep task. Same rules as any bài bổ sung (required, minimum minutes); only its tag says
 *   "Ôn thi" and the prefix is not repeated in its name. No database column: the parent writes it
 *   in the title, so it stays family data.
 */

type Named = { source: "homework" | "template"; part: 1 | 2; title: string; subject: string | null };

const EXAM = /^\s*ôn\s+thi(?:\s*[:·\-–—|]\s*|\s+|$)/iu;

/** A bài bổ sung whose title starts with "Ôn thi". */
export function isExamPrep(i: Named): boolean {
  return i.source === "template" && i.part === 1 && EXAM.test(i.title.normalize("NFC"));
}

/** The task's own title, without the "Ôn thi" prefix of an exam-prep task. */
function bareTitle(i: Named): string {
  const t = i.title.normalize("NFC").trim();
  return isExamPrep(i) ? t.replace(EXAM, "").trim() : t;
}

/** The two parts of a task's name: the subject (bold on screen) and the rest (may be empty). */
export function nameParts(i: Named): { subject: string | null; rest: string } {
  if (i.source === "homework") return { subject: null, rest: i.title };
  const title = bareTitle(i);
  const subject = i.subject?.normalize("NFC").trim() || null;
  if (!subject) return { subject: null, rest: title || i.title };
  if (!title) return { subject, rest: "" };
  if (title.toLowerCase() === subject.toLowerCase()) return { subject: title, rest: "" };
  return { subject, rest: title };
}

/** "English · Practice" (the name read out and used in sentences). */
export function taskName(i: Named): string {
  const { subject, rest } = nameParts(i);
  return [subject, rest].filter(Boolean).join(" · ");
}

/** The parent's "Bài ôn thi" tick (template form): add or remove the "Ôn thi · " prefix of a title. */
export function withExamPrefix(title: string, on: boolean): string {
  const bare = title.normalize("NFC").replace(EXAM, "").trim();
  return on ? (bare ? `Ôn thi · ${bare}` : "Ôn thi") : bare;
}
