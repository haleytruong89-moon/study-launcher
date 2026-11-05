/**
 * "Chế độ Tin tưởng" — parent side (S3d, SPEC section 7, DESIGN section 5 "Tiến độ Tin tưởng").
 * PURE helpers: the request body, and whether the parent's Hôm nay card shows a suggestion.
 *
 * The SYSTEM ONLY SUGGESTS (computeDayState: trust.suggestTrust / trust.suggestLock, unchanged);
 * the parent decides. Lock/open itself is computeDayState row 3 (OPEN_TRUST), also unchanged.
 *
 * Interpretation (đề xuất, chờ bố mẹ chốt): once a parent has decided in the CURRENT
 * Monday-week — switched the mode either way ("trust.set") or tapped "Để sau" on that
 * suggestion ("trust.dismissed") — the card stays hidden until next Monday. The suggestion is
 * computed from COMPLETE weeks only, so it cannot change before Monday anyway. Both decisions
 * are read back from audit_log (no new table or column).
 */
import { z } from "zod";
import type { TrustMode, TrustView } from "@/lib/dayState";
import { startOfLocalDay, weekStart } from "@/lib/time";

export const TRUST_SET = "trust.set";
export const TRUST_DISMISSED = "trust.dismissed";

export type TrustSuggestion = TrustMode; // "trust" = suggest Tin tưởng, "lock" = suggest going back to Khóa

/** POST /api/admin/trust: either switch the mode, or "Để sau" on the current suggestion. */
export const trustBodySchema = z.union([
  z.object({
    childId: z.uuid(),
    mode: z.enum(["lock", "trust"]),
    /** Where the parent tapped: the suggestion card or the manual switch (only for the log). */
    via: z.enum(["suggestion", "manual"]).default("manual"),
  }),
  z.object({
    childId: z.uuid(),
    later: z.enum(["lock", "trust"]),
  }),
]);
export type TrustBody = z.infer<typeof trustBodySchema>;

export interface TrustDecisionRow {
  action: string;
  payload: unknown;
  created_at: string;
}

/** Start of the current Monday-week (family time zone) as an ISO instant, for the audit query. */
export function weekStartIso(today: string): string {
  return startOfLocalDay(weekStart(today)).toISOString();
}

function payloadOf(row: TrustDecisionRow): Record<string, unknown> {
  return row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {};
}

/**
 * The suggestion to show on the parent's card for ONE child, or null.
 * `decisions` = this family's trust.set / trust.dismissed rows since this week's Monday
 * (any child: filtered here).
 */
export function trustSuggestion(childId: string, trust: Pick<TrustView, "suggestTrust" | "suggestLock">, decisions: readonly TrustDecisionRow[]): TrustSuggestion | null {
  const suggestion: TrustSuggestion | null = trust.suggestTrust ? "trust" : trust.suggestLock ? "lock" : null;
  if (suggestion === null) return null;
  for (const row of decisions) {
    const p = payloadOf(row);
    if (p.child_id !== childId) continue;
    if (row.action === TRUST_SET) return null;
    if (row.action === TRUST_DISMISSED && p.suggestion === suggestion) return null;
  }
  return suggestion;
}

/** Card wording for a suggestion (display only). */
export function suggestionText(
  suggestion: TrustSuggestion,
  name: string,
  trust: Pick<TrustView, "weeksMet" | "weeksNeeded">,
  rules: { trustUpPct: number; trustDownPct: number },
): { title: string; changes: string[]; yes: string } {
  if (suggestion === "trust") {
    return {
      title: `${name} đã đạt ${trust.weeksMet}/${trust.weeksNeeded} tuần liên tiếp (≥ ${rules.trustUpPct}% ngày đạt) — chuyển sang chế độ Tin tưởng?`,
      changes: [
        "Laptop mở mọi trang ngay cả khi chưa xong việc.",
        "Launcher vẫn hiện việc hôm nay, đồng hồ và nhắc nhở như cũ.",
        "Bố mẹ chuyển lại chế độ Khóa được bất cứ lúc nào.",
      ],
      yes: "Chuyển sang Tin tưởng",
    };
  }
  return {
    title: `Tuần trước ${name} đạt dưới ${rules.trustDownPct}% ngày — quay lại chế độ Khóa?`,
    changes: ["Laptop lại chỉ mở trang học cho đến khi xong việc.", "Giờ nghỉ và giờ tự do theo luật trong nhà như trước."],
    yes: "Quay lại chế độ Khóa",
  };
}

export const MODE_LABEL: Record<TrustMode, string> = { lock: "Khóa", trust: "Tin tưởng" };
