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

export const decisionSchema = z.object({ decision: z.enum(["15m", "day", "permanent", "permanent_base", "deny"]) });
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
  permanent_base: "approved_permanent",
  deny: "denied",
};

export const DECISION_DURATION: Record<Exclude<Decision, "deny">, Duration> = {
  "15m": "15m",
  day: "today",
  permanent: "permanent",
  permanent_base: "permanent",
};

/** Second-level labels under a 2-letter country TLD that are a registry, not a site (abc.edu.vn). */
const COUNTRY_SECOND_LEVEL = new Set(["com", "edu", "gov", "net", "org", "co", "ac", "int", "info", "biz", "name", "pro", "health"]);

/** Registrable domain of a host: redirect.zalo.me → zalo.me, thcs.hanoi.edu.vn → hanoi.edu.vn. */
export function baseDomain(domain: string): string {
  const labels = domain.split(".");
  if (labels.length <= 2) return domain;
  const tld = labels[labels.length - 1] ?? "";
  const second = labels[labels.length - 2] ?? "";
  const keep = tld.length === 2 && COUNTRY_SECOND_LEVEL.has(second) ? 3 : 2;
  return labels.slice(-keep).join(".");
}

/**
 * The wider domain a parent may open for good from a request (one tap instead of asking
 * again for every sub-site, e.g. redirect.zalo.me → zalo.me), or null when there is none or
 * it would open a forbidden site (google.com, youtube.com, vercel.app, …).
 */
export function wideDomainOffer(domain: string): string | null {
  const base = baseDomain(domain);
  if (base === domain || permanentProblem(base)) return null;
  return base;
}

export const GROUP_LABEL: Record<string, string> = {
  system: "Hệ thống",
  internal: "App nhà mình",
  external: "App bên ngoài",
  dictionary: "Từ điển / dịch",
  child_pick: "Con chọn",
  request: "Con xin mở",
};
