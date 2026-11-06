/**
 * Check-ins (docs/BINH_YEN.md §2.2 by_checkins, §4, D1, D5). PURE: validation and the views the
 * child sees. Only fixed KEYS are ever accepted — never free text (D1). Validation happens
 * before any database write, so Postgres never has a reason to quote a row in an error (D5).
 */
import { z } from "zod";
import { HOTLINE_TEXT } from "./rules";
import { activityAllowed, activityText, findActivity, findWord, isPleasant, isQuad, type Quad, type Voice } from "./catalog";

/** How many recent visits the child's home lists ("Lần ghé gần đây"). */
export const RECENT_LIMIT = 7;

/** POST /api/by/checkins. `activity: null` = "Vậy là đủ cho hôm nay" (naming counts as done). */
export const checkinBodySchema = z
  .object({
    clientRunId: z.uuid(),
    quad: z.string().max(16),
    word: z.string().max(40),
    intensity: z.number().int().min(1).max(5).nullable(),
    activity: z.string().max(40).nullable(),
  })
  .strict();
export type CheckinBody = z.infer<typeof checkinBodySchema>;

/** POST /api/by/checkins/delete: one visit, or everything of this child. */
export const deleteBodySchema = z.union([z.object({ id: z.uuid() }).strict(), z.object({ all: z.literal(true) }).strict()]);

/** Why this check-in cannot be stored, or null. Wording is for logs-free 400 answers. */
export function checkinProblem(voice: Voice, b: CheckinBody): string | null {
  if (!isQuad(b.quad)) return "Ô cảm xúc không hợp lệ.";
  const w = findWord(b.word);
  if (!w || w.retired || w.quad !== b.quad) return "Từ cảm xúc không hợp lệ.";
  if (isPleasant(b.quad)) {
    if (b.intensity !== null) return "Mức độ chỉ dành cho cảm xúc khó chịu.";
  } else if (b.intensity === null) {
    return "Thiếu mức độ.";
  }
  if (b.activity !== null && !activityAllowed(voice, b.activity)) return "Hoạt động không hợp lệ.";
  return null;
}

/** A by_checkins row as the server reads it (no text columns exist). */
export interface CheckinRow {
  id: string;
  local_date: string;
  quad: string;
  word_key: string;
  intensity: number | null;
  activity_key: string | null;
  created_at: string;
}

export interface CheckinView {
  id: string;
  /** "05/11" */
  date: string;
  quad: Quad | null;
  word: string;
  activity: string | null;
}

/** What "Lần ghé gần đây" shows: date, word, activity. No counts, no streaks (SPEC §15). */
export function checkinView(row: CheckinRow, voice: Voice): CheckinView {
  const w = findWord(row.word_key);
  const a = row.activity_key ? findActivity(row.activity_key) : undefined;
  return {
    id: row.id,
    date: `${row.local_date.slice(8, 10)}/${row.local_date.slice(5, 7)}`,
    quad: isQuad(row.quad) ? row.quad : null,
    word: w?.label ?? "(từ cũ)",
    activity: row.activity_key ? (a ? activityText(a, voice).title : "(hoạt động cũ)") : null,
  };
}

/** Repeated "rất to" without any text (BINH_YEN R3): 3 times intensity 5 in 7 days. */
export const HEAVY_REPEAT_COUNT = 3;
export const HEAVY_REPEAT_DAYS = 7;

export function heavyRepeat(rows: Pick<CheckinRow, "intensity" | "created_at">[], now: Date): boolean {
  const since = now.getTime() - HEAVY_REPEAT_DAYS * 86_400_000;
  return rows.filter((r) => r.intensity === 5 && Date.parse(r.created_at) >= since).length >= HEAVY_REPEAT_COUNT;
}

/** Shown ONLY to the child (Q4: never reported to the parents). */
export const HEAVY_REPEAT_TEXT = `Mấy ngày nay con đã thấy “rất to” nhiều lần. Con không phải mang nó một mình: nói với bố mẹ hoặc thầy cô con tin, hoặc ${HOTLINE_TEXT} để có người lắng nghe.`;

export const NOT_SAVED_TEXT = "Chưa lưu được, thử lại nhé.";
export const LOCKED_TEXT = "Góc bình yên đã tự khóa. Gõ PIN để vào lại.";
