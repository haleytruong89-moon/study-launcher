import { z } from "zod";
import { MAX_HOMEWORK_FILES } from "@/lib/files";

/**
 * Validation for the parent's admin forms (slice S1). Every family rule is data (CLAUDE.md),
 * so these schemas only guard shape and sane ranges, never encode the rules themselves.
 */

const HOSTNAME_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/**
 * Turns what a parent types ("https://www.Example.com/path", "*.example.com", "example.com:443")
 * into a bare lowercase hostname, or null when it is not a valid public hostname.
 */
export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // scheme
  s = s.replace(/^\*\./, ""); // wildcard prefix
  s = s.split(/[/?#]/, 1)[0] ?? ""; // path, query, fragment
  s = s.replace(/^[^@]*@/, ""); // userinfo
  s = s.replace(/:\d+$/, ""); // port
  s = s.replace(/\.$/, ""); // trailing dot
  return HOSTNAME_RE.test(s) ? s : null;
}

/**
 * Domains a slot must never add to the allowlist:
 * - bare shared-hosting / registry suffixes: allowing them would open EVERY site under them
 *   (anyone's vercel.app or github.io page, including web proxies);
 * - Google Search and YouTube (CLAUDE.md: never open while locked). Specific subdomains such as
 *   classroom.google.com stay allowed.
 */
const FORBIDDEN_SLOT_DOMAINS = new Set([
  "vercel.app", "netlify.app", "github.io", "pages.dev", "web.app", "firebaseapp.com", "herokuapp.com",
  "blogspot.com", "glitch.me", "onrender.com", "fly.dev", "workers.dev", "repl.co", "translate.goog",
  "com.vn", "edu.vn", "net.vn", "org.vn", "gov.vn", "co.uk", "com.au",
  "google.com", "www.google.com", "google.com.vn", "www.google.com.vn",
  "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
]);

/**
 * Google Search / YouTube under ANY country domain (google.co.uk, www.google.de,
 * youtube.com.vn …) — audit 24/10: only the .com / .com.vn ones were listed.
 * Sub-sites such as translate.google.co.uk are not matched.
 */
const SEARCH_OR_VIDEO_COUNTRY_RE = /^(?:www\.|m\.)?(?:google|youtube)\.(?:(?:com?|co)\.)?[a-z]{2,3}$/;

/** Null when the domain may be added by a slot, otherwise a Vietnamese reason. */
export function slotDomainProblem(domain: string): string | null {
  if (FORBIDDEN_SLOT_DOMAINS.has(domain) || domain.endsWith(".translate.goog") || SEARCH_OR_VIDEO_COUNTRY_RE.test(domain)) {
    return `Không thêm được “${domain}”: tên miền này sẽ mở quá nhiều trang (hoặc là Google Search / YouTube). Hãy nhập tên miền cụ thể của app.`;
  }
  return null;
}

/** Hostname of an http(s) URL, normalized, or null. */
export function hostnameOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return normalizeDomain(u.hostname);
  } catch {
    return null;
  }
}

const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => hostnameOf(v) !== null, "Địa chỉ phải bắt đầu bằng https:// hoặc http://");

/** Empty string from a form field means "not set". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const optionalUrl = z
  .union([httpUrl, z.literal(""), z.null(), z.undefined()])
  .transform((v) => (v ? v : null));

export const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidLocalDate(v: string): boolean {
  if (!LOCAL_DATE_RE.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const localDateSchema = z.string().refine(isValidLocalDate, "Ngày không hợp lệ");

const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Giờ không hợp lệ")
  .transform((v) => v.slice(0, 5));

// ---------------------------------------------------------------------------
// Family settings (family_settings + each child's bedtime)
// ---------------------------------------------------------------------------

const int = (min: number, max: number) => z.number().int().min(min).max(max);

export const settingsSchema = z
  .object({
    breakMinutes: int(0, 60),
    freeMinutes: int(0, 240),
    extraMinMinutes: int(0, 180),
    skillMinMinutes: int(0, 180),
    passesPerWeek: int(0, 7),
    trustUpPct: int(0, 100),
    trustUpWeeks: int(1, 12),
    trustDownPct: int(0, 100),
    homeworkLookaheadDays: int(0, 7),
    /** 0002 (S2c). Optional: the form omits it until that migration has run. */
    homeworkMinUpcoming: int(0, 5).optional(),
    photoRetentionDays: int(7, 365),
    /** 0007: saved .html/.htm/.pdf files may open in study time. Optional (absent before 0007). */
    allowLocalFiles: z.boolean().optional(),
    /** 0008 Góc bình yên: switch (off by default) + limits. Optional (absent before 0008). */
    byEnabled: z.boolean().optional(),
    byStudyMinutes: int(5, 60).optional(),
    byIdleLockMinutes: int(2, 15).optional(),
    bedtimes: z.array(z.object({ childId: z.uuid(), bedtime: timeOfDay })).max(10).default([]),
  })
  .refine((s) => s.trustDownPct <= s.trustUpPct, {
    message: "Ngưỡng quay về Khóa phải nhỏ hơn hoặc bằng ngưỡng lên Tin tưởng",
    path: ["trustDownPct"],
  });
export type SettingsInput = z.infer<typeof settingsSchema>;

/** family_settings row columns for an update. */
export function settingsToRow(s: SettingsInput) {
  return {
    break_minutes: s.breakMinutes,
    free_minutes: s.freeMinutes,
    extra_min_minutes: s.extraMinMinutes,
    skill_min_minutes: s.skillMinMinutes,
    passes_per_week: s.passesPerWeek,
    trust_up_pct: s.trustUpPct,
    trust_up_weeks: s.trustUpWeeks,
    trust_down_pct: s.trustDownPct,
    homework_lookahead_days: s.homeworkLookaheadDays,
    photo_retention_days: s.photoRetentionDays,
    ...(s.homeworkMinUpcoming === undefined ? {} : { homework_min_upcoming: s.homeworkMinUpcoming }),
    ...(s.allowLocalFiles === undefined ? {} : { allow_local_files: s.allowLocalFiles }),
    ...(s.byEnabled === undefined ? {} : { by_enabled: s.byEnabled }),
    ...(s.byStudyMinutes === undefined ? {} : { by_study_minutes: s.byStudyMinutes }),
    ...(s.byIdleLockMinutes === undefined ? {} : { by_idle_lock_minutes: s.byIdleLockMinutes }),
  };
}

// ---------------------------------------------------------------------------
// App slots
// ---------------------------------------------------------------------------

export const SLOT_KINDS = ["internal", "external", "placeholder"] as const;

export const slotSchema = z
  .object({
    childId: z.uuid().nullish().transform((v) => v ?? null), // null = whole family
    subject: z.string().trim().min(1).max(40),
    kind: z.enum(SLOT_KINDS),
    label: z.string().trim().min(1).max(80),
    url: optionalUrl,
    allowDomains: z.array(z.string().max(300)).max(20).default([]),
    active: z.boolean().default(true),
  })
  .superRefine((s, ctx) => {
    if (s.kind !== "placeholder" && !s.url) {
      ctx.addIssue({ code: "custom", path: ["url"], message: "App đang dùng được cần có địa chỉ" });
    }
    for (const d of s.allowDomains) {
      if (normalizeDomain(d) === null) {
        ctx.addIssue({ code: "custom", path: ["allowDomains"], message: `Tên miền không hợp lệ: ${d}` });
      }
    }
    for (const d of slotDomains(s)) {
      const problem = slotDomainProblem(d);
      if (problem) ctx.addIssue({ code: "custom", path: ["allowDomains"], message: problem });
    }
  });
export type SlotInput = z.infer<typeof slotSchema>;

/**
 * Domains that the slot adds to the allowlist (DESIGN section 4: "domain của slot tự vào allowlist"):
 * the typed domains plus the slot URL's own host, normalized and de-duplicated.
 */
export function slotDomains(s: Pick<SlotInput, "url" | "allowDomains">): string[] {
  const out = new Set<string>();
  for (const d of s.allowDomains) {
    const n = normalizeDomain(d);
    if (n) out.add(n);
  }
  if (s.url) {
    const h = hostnameOf(s.url);
    if (h) out.add(h);
  }
  return [...out];
}

export function slotToRow(s: SlotInput) {
  return {
    child_id: s.childId,
    subject: s.subject,
    kind: s.kind,
    label: s.label,
    url: s.url,
    allow_domains: slotDomains(s),
    active: s.active,
  };
}

// ---------------------------------------------------------------------------
// Task templates (supplementary work + skills, by weekday)
// ---------------------------------------------------------------------------

export const TEMPLATE_PARTS = ["extra", "skill"] as const;

export const templateSchema = z.object({
  childId: z.uuid(),
  part: z.enum(TEMPLATE_PARTS),
  title: z.string().trim().min(1).max(120),
  subject: optionalText(40),
  appSlotId: z.uuid().nullish().transform((v) => v ?? null),
  weekdays: z
    .array(int(1, 7))
    .min(1, "Chọn ít nhất 1 thứ trong tuần")
    .max(7)
    .transform((w) => [...new Set(w)].sort((a, b) => a - b)),
  minMinutes: int(0, 240).nullish().transform((v) => v ?? null), // null = family default
  deepLink: optionalUrl,
  sort: int(-1000, 1000).default(0),
  active: z.boolean().default(true),
});
export type TemplateInput = z.infer<typeof templateSchema>;

export function templateToRow(t: TemplateInput) {
  return {
    child_id: t.childId,
    part: t.part,
    title: t.title,
    subject: t.subject,
    app_slot_id: t.appSlotId,
    weekdays: t.weekdays,
    min_minutes: t.minMinutes,
    deep_link: t.deepLink,
    sort: t.sort,
    active: t.active,
  };
}

// ---------------------------------------------------------------------------
// Homework assignment (parent attaches files, 1 subject + 1 due date per item)
// ---------------------------------------------------------------------------

const homeworkFields = {
  subject: z.string().trim().min(1).max(40),
  dueDate: localDateSchema,
  note: optionalText(500),
  photoPaths: z.array(z.string().max(300)).max(MAX_HOMEWORK_FILES, `Tối đa ${MAX_HOMEWORK_FILES} tệp mỗi bài`).default([]),
};
const needsContent = {
  check: (h: { photoPaths: string[]; note: string | null }) => h.photoPaths.length > 0 || h.note !== null,
  message: "Cần ít nhất 1 tệp hoặc ghi chú",
};

export const homeworkSchema = z
  .object({ childId: z.uuid(), ...homeworkFields })
  .refine(needsContent.check, { message: needsContent.message, path: ["photoPaths"] });
export type HomeworkInput = z.infer<typeof homeworkSchema>;

/** Parent edits a homework item (S2c): subject, due date, note, attachments. */
export const homeworkEditSchema = z
  .object(homeworkFields)
  .refine(needsContent.check, { message: needsContent.message, path: ["photoPaths"] });
export type HomeworkEditInput = z.infer<typeof homeworkEditSchema>;

/** PATCH /api/admin/homework/[id]: archive/restore, or an edit. */
export const homeworkPatchSchema = z.union([z.object({ archived: z.boolean() }).strict(), homeworkEditSchema]);

// ---------------------------------------------------------------------------
// Child profile edits (name, grade, colour)
// ---------------------------------------------------------------------------

export const childProfileSchema = z.object({
  displayName: z.string().trim().min(1, "Nhập tên hiển thị").max(80),
  grade: int(1, 12),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Màu không hợp lệ"),
});
export type ChildProfileInput = z.infer<typeof childProfileSchema>;
