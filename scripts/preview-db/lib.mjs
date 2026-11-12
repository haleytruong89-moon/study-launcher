// Pure helpers for the PREVIEW database scripts (scripts/preview-db/*). No I/O here, so they
// are unit-tested in tests/previewDb.test.ts. The same rules exist in bash (guard.sh) and SQL
// (db-guard.sh, reset.sql): keep the three in step.

/** A Supabase project ref: 20 lowercase letters. */
export const REF_RE = /^[a-z]{20}$/;

/**
 * Only these e-mail domains may exist in the preview project's auth.users. A database holding
 * any other address (a parent's real e-mail) is treated as PRODUCTION and never wiped.
 * example.com = seeded test parent; study-launcher.local = child accounts (CHILD_EMAIL_DOMAIN default).
 */
export const TEST_EMAIL_DOMAINS = ["example.com", "study-launcher.local"];

/** True for an address the seed (or a test) could have made; null / malformed = not a test account. */
export function isTestEmail(email) {
  if (typeof email !== "string") return false;
  const at = email.lastIndexOf("@");
  if (at < 1) return false;
  return TEST_EMAIL_DOMAINS.includes(email.slice(at + 1).toLowerCase());
}

/**
 * Finds the project ref inside a Supabase Postgres connection string, without ever returning the
 * password. Accepts the direct host (db.<ref>.supabase.co) and the shared pooler
 * (user postgres.<ref> @ *.pooler.supabase.com). Anything else, or two different refs, -> null.
 */
export function refFromDbUrl(dbUrl) {
  if (typeof dbUrl !== "string") return null;
  const m = /^postgres(?:ql)?:\/\/(.+)$/.exec(dbUrl.trim());
  if (!m) return null;
  const rest = m[1];
  const at = rest.lastIndexOf("@");
  if (at < 1) return null;
  const userinfo = rest.slice(0, at);
  const host = rest.slice(at + 1).split(/[/?#]/)[0].split(":")[0].toLowerCase();
  const user = userinfo.split(":")[0];

  const userRef = /^postgres\.([a-z]{20})$/.exec(user)?.[1] ?? null;
  const directRef = /^db\.([a-z]{20})\.supabase\.co$/.exec(host)?.[1] ?? null;
  const pooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(host);

  if (directRef) return userRef && userRef !== directRef ? null : directRef;
  if (pooler) return userRef;
  return null;
}

/** Ref of an API URL like https://<ref>.supabase.co ; anything else -> null. */
export function refFromApiUrl(apiUrl) {
  if (typeof apiUrl !== "string") return null;
  return /^https:\/\/([a-z]{20})\.supabase\.co\/?$/.exec(apiUrl.trim())?.[1] ?? null;
}

/**
 * The "ref" claim of a legacy JWT service_role key, or null when the key is not such a JWT
 * (e.g. a new sb_secret_... key, which carries no ref and simply fails on another project).
 */
export function refFromJwtKey(key) {
  if (typeof key !== "string") return null;
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof payload?.ref === "string" ? payload.ref : null;
  } catch {
    return null;
  }
}

/**
 * Every check the Node side makes before calling the preview project's API. Returns the preview
 * ref and API URL, or a Vietnamese reason to refuse. Never includes secret values in the reason.
 */
export function checkPreviewTarget({ previewDbUrl, productionRef, serviceKey, localApiUrl }) {
  // CI only (ci.yml e2e job): the local Supabase stack on this machine. A loopback address can
  // never reach a hosted project, so the ref checks below do not apply.
  if (localApiUrl) {
    let u = null;
    try {
      u = new URL(localApiUrl);
    } catch {
      /* invalid */
    }
    if (!u || u.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(u.hostname)) {
      return { ok: false, reason: "PREVIEW_LOCAL_API_URL chỉ dùng cho Supabase chạy trên chính máy này (http://127.0.0.1)." };
    }
    if (!serviceKey) return { ok: false, reason: "Thiếu secret PREVIEW_SERVICE_ROLE_KEY." };
    return { ok: true, ref: "local", apiUrl: u.origin };
  }
  if (!previewDbUrl) return { ok: false, reason: "Thiếu secret PREVIEW_DB_URL." };
  if (!productionRef || !REF_RE.test(productionRef)) {
    return { ok: false, reason: "PRODUCTION_PROJECT_REF chưa đặt hoặc sai dạng (20 chữ thường)." };
  }
  const ref = refFromDbUrl(previewDbUrl);
  if (!ref) return { ok: false, reason: "Không đọc được mã project từ PREVIEW_DB_URL (phải là chuỗi kết nối Supabase)." };
  if (ref === productionRef || previewDbUrl.toLowerCase().includes(productionRef)) {
    return { ok: false, reason: "PREVIEW_DB_URL trỏ vào project THẬT. Dừng." };
  }
  if (!serviceKey) return { ok: false, reason: "Thiếu secret PREVIEW_SERVICE_ROLE_KEY." };
  const keyRef = refFromJwtKey(serviceKey);
  if (keyRef !== null && keyRef !== ref) {
    return { ok: false, reason: "PREVIEW_SERVICE_ROLE_KEY không thuộc project preview. Dừng." };
  }
  return { ok: true, ref, apiUrl: `https://${ref}.supabase.co` };
}

/** Local calendar date (YYYY-MM-DD) in Vietnam, plus n days. */
export function vnDate(now, addDays = 0) {
  const d = new Date(now.getTime() + addDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(d);
}

/** Fake family used by the seed. Never real names (CLAUDE.md / task D4). */
export const SEED = {
  familyName: "Gia đình thử (preview)",
  parent: { email: "phu-huynh-thu@example.com", displayName: "Phụ huynh thử" },
  children: [
    {
      email: "con-a@study-launcher.local",
      displayName: "Con A",
      grade: 9,
      color: "#2F5D9E",
      templates: [
        { part: "extra", title: "Luyện đề Toán (thử)", subject: "Toán", min_minutes: 20 },
        { part: "skill", title: "Đọc sách (thử)", subject: null, min_minutes: 20 },
      ],
      homework: [
        { subject: "Ngữ văn", addDays: 0, note: "Bài thử: đọc đoạn 1, trả lời câu 1–3" },
        { subject: "Toán", addDays: 1, note: "Bài thử: bài 1–4 trang 20" },
      ],
    },
    {
      email: "con-b@study-launcher.local",
      displayName: "Con B",
      grade: 6,
      color: "#B85A1C",
      templates: [
        { part: "extra", title: "Ôn Tiếng Anh (thử)", subject: "Tiếng Anh", min_minutes: 20 },
        { part: "skill", title: "Vẽ (thử)", subject: null, min_minutes: 20 },
      ],
      homework: [
        { subject: "Khoa học tự nhiên", addDays: 0, note: "Bài thử: học bài 3" },
        { subject: "Toán", addDays: 2, note: "Bài thử: bài 5–8 trang 41" },
      ],
    },
  ],
};
