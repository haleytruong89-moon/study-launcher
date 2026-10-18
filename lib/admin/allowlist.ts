/**
 * "Trang học được mở" + "Xin mở trang" (S3d, parent decisions 18/10/2026). PURE helpers.
 * Every entry is data in allowlist_entries (CLAUDE.md: family rules are data). The
 * forbidden list (Google Search, YouTube, *.translate.goog, …) can never be allowed for
 * good; a parent may still open such a site for 15 minutes or the rest of today.
 */
import { z } from "zod";
import { nextMidnight } from "@/lib/time";
import { hostnameOf, normalizeDomain, slotDomainProblem } from "./schemas";

export type Duration = "permanent" | "today" | "15m";

export const allowAddSchema = z.object({
  domain: z.string().trim().min(1).max(300),
  /** null = both children. */
  childId: z.uuid().nullable(),
  duration: z.enum(["permanent", "today"]),
});

export const requestSchema = z.object({
  url: z.string().trim().min(1).max(2000),
  reason: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : null)),
});

export const decisionSchema = z.object({ decision: z.enum(["15m", "day", "permanent", "deny"]) });
export type Decision = z.infer<typeof decisionSchema>["decision"];

/** Normalised domain the parent typed (a domain or a full link), or an error message. */
export function domainFromInput(input: string): { ok: true; domain: string } | { ok: false; error: string } {
  const raw = input.trim();
  const domain = /^https?:\/\//i.test(raw) ? hostnameOf(raw) : normalizeDomain(raw);
  if (!domain) return { ok: false, error: "Nhập tên miền (vd meet.google.com) hoặc dán đường link." };
  return { ok: true, domain };
}

/** expires_at for an allow entry, on the SERVER clock (every window ends by 00:00). */
export function expiresAt(duration: Duration, now: Date): string | null {
  if (duration === "permanent") return null;
  const midnight = nextMidnight(now).getTime();
  if (duration === "today") return new Date(midnight).toISOString();
  return new Date(Math.min(now.getTime() + 15 * 60_000, midnight)).toISOString();
}

/** A permanent entry may not open a forbidden site; null = fine. */
export function permanentProblem(domain: string): string | null {
  if (/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(domain)) {
    return `Không thêm “${domain}” vĩnh viễn được (YouTube). Có thể mở 15 phút hoặc đến hết hôm nay.`;
  }
  return slotDomainProblem(domain);
}

export const DECISION_STATUS: Record<Decision, "approved_15m" | "approved_day" | "approved_permanent" | "denied"> = {
  "15m": "approved_15m",
  day: "approved_day",
  permanent: "approved_permanent",
  deny: "denied",
};

export const DECISION_DURATION: Record<Exclude<Decision, "deny">, Duration> = { "15m": "15m", day: "today", permanent: "permanent" };

export const GROUP_LABEL: Record<string, string> = {
  system: "Hệ thống",
  internal: "App nhà mình",
  external: "App bên ngoài",
  dictionary: "Từ điển / dịch",
  child_pick: "Con chọn",
  request: "Con xin mở",
};
