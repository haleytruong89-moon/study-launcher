/**
 * "Góp ý" — the children's feedback about the APP (parent decision 07/11/2026). PURE: schema,
 * labels and limits, so tests pin them. Not private (unlike Góc bình yên): parents read every
 * line on Thêm › Góp ý của con, and the screen says so before the child sends. No push.
 */
import { z } from "zod";

export const FEEDBACK_KINDS = ["like", "dislike", "idea"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_LABELS: Record<FeedbackKind, string> = {
  like: "👍 Thích",
  dislike: "👎 Chưa thích",
  idea: "💡 Ý tưởng",
};

/** Same limit as the database CHECK (0010_app_feedback.sql). */
export const FEEDBACK_MAX_CHARS = 500;
/** At most this many per child per Vietnam day (server-side count). */
export const FEEDBACK_DAILY_LIMIT = 10;

/** What the child is told before sending (honest: it is not private). */
export const FEEDBACK_NOT_PRIVATE = "Bố mẹ sẽ đọc góp ý này.";
export const FEEDBACK_SENT = "Đã gửi. Cảm ơn con!";
export const FEEDBACK_LIMIT_TEXT = `Hôm nay con đã gửi ${FEEDBACK_DAILY_LIMIT} góp ý rồi. Mai gửi tiếp nhé.`;
export const FEEDBACK_NOT_READY = "Phần Góp ý chưa dùng được (bố mẹ cần cập nhật app). Con nói trực tiếp với bố mẹ nhé.";

/** POST /api/feedback. The text is trimmed; 1–500 characters after trimming. */
export const feedbackBodySchema = z
  .object({
    kind: z.enum(FEEDBACK_KINDS),
    body: z
      .string()
      .max(FEEDBACK_MAX_CHARS * 2, `Tối đa ${FEEDBACK_MAX_CHARS} ký tự.`)
      .transform((v) => v.trim())
      .pipe(z.string().min(1, "Con viết vài chữ nhé.").max(FEEDBACK_MAX_CHARS, `Tối đa ${FEEDBACK_MAX_CHARS} ký tự.`)),
  })
  .strict();
export type FeedbackBody = z.infer<typeof feedbackBodySchema>;

export function feedbackLimitReached(sentToday: number): boolean {
  return sentToday >= FEEDBACK_DAILY_LIMIT;
}

export function isFeedbackKind(v: unknown): v is FeedbackKind {
  return typeof v === "string" && (FEEDBACK_KINDS as readonly string[]).includes(v);
}

/** Before migration 0010 the table does not exist (preview before merge): PostgREST / Postgres codes. */
export function tableMissing(error: { code?: string } | null | undefined): boolean {
  return !!error && (error.code === "PGRST205" || error.code === "42P01");
}
