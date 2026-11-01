/** Pure evaluation of "is this deployment correctly set up?" (see app/api/health/ready). */

export const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "FIRST_PARENT_EMAIL",
] as const;

/** S5 Web Push + evening reminder. Missing = a warning only (the app works without push). */
export const PUSH_ENV = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "CRON_SECRET"] as const;

export const EXPECTED_TABLES = [
  "families",
  "profiles",
  "family_settings",
  "app_slots",
  "task_templates",
  "homework_items",
  "task_runs",
  "day_sessions",
  "overrides",
  "allowlist_entries",
  "unlock_requests",
  "extension_devices",
  "push_subscriptions",
  "trust_state",
  "audit_log",
] as const;

export const EXPECTED_BUCKETS = ["homework", "proofs"] as const;

export interface ReadinessInput {
  envMissing: string[];
  /** null = not checked (because env is missing) */
  dbReachable: boolean | null;
  tablesMissing: string[];
  bucketsMissing: string[];
  /** Supabase "Allow new users to sign up" turned off? null = could not be determined. */
  signupDisabled: boolean | null;
  /** Does the request host match NEXT_PUBLIC_APP_URL? */
  hostMatchesAppUrl: boolean | null;
  /** null = not checked */
  familyExists: boolean | null;
  /** S5: push env vars not set yet (VAPID keys, CRON_SECRET). Optional = treated as none. */
  pushMissing?: string[];
}

export interface ReadinessCheck {
  name: string;
  ok: boolean;
  /** "error" makes the whole deployment not ready; "warn" is informational. */
  level: "error" | "warn";
  /** Vietnamese hint for the parent when the check fails. */
  hint: string;
}

export interface ReadinessResult {
  ok: boolean;
  checks: ReadinessCheck[];
}

export function evaluateReadiness(input: ReadinessInput): ReadinessResult {
  const checks: ReadinessCheck[] = [
    {
      name: "env",
      ok: input.envMissing.length === 0,
      level: "error",
      hint: `Thiếu biến môi trường trên Vercel: ${input.envMissing.join(", ")} (SETUP bước A4).`,
    },
    {
      name: "database",
      ok: input.dbReachable === true,
      level: "error",
      hint: "Không nối được Supabase. Kiểm tra NEXT_PUBLIC_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY.",
    },
    {
      name: "tables",
      ok: input.dbReachable === true && input.tablesMissing.length === 0,
      level: "error",
      hint: `Chưa có đủ bảng (thiếu: ${input.tablesMissing.join(", ") || "chưa kiểm tra được"}). Đã merge PR chưa, và SQL đã chạy chưa?`,
    },
    {
      name: "buckets",
      ok: input.dbReachable === true && input.bucketsMissing.length === 0,
      level: "error",
      hint: `Chưa có đủ kho ảnh (thiếu: ${input.bucketsMissing.join(", ") || "chưa kiểm tra được"}).`,
    },
    {
      name: "signup_disabled",
      ok: input.signupDisabled === true,
      level: "error",
      hint: "Supabase đang cho người lạ tự đăng ký. Tắt 'Allow new users to sign up' (SETUP bước A7).",
    },
    {
      name: "app_url_matches_host",
      ok: input.hostMatchesAppUrl === true,
      level: "warn",
      hint: "NEXT_PUBLIC_APP_URL khác địa chỉ đang mở. Bình thường với link preview; với link chính thức thì cần sửa.",
    },
    {
      name: "family_created",
      ok: input.familyExists === true,
      level: "warn",
      hint: "Chưa thiết lập gia đình. Đăng nhập tài khoản phụ huynh để làm 'Thiết lập lần đầu'.",
    },
    {
      name: "push_configured",
      ok: (input.pushMissing ?? []).length === 0,
      level: "warn",
      hint: `Thông báo đẩy chưa bật (thiếu: ${(input.pushMissing ?? []).join(", ")}). Phụ huynh vào Thêm › Thông báo để tạo khóa (SETUP bước A10).`,
    },
  ];

  return { ok: checks.every((c) => c.ok || c.level === "warn"), checks };
}
