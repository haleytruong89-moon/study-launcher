/**
 * Why a child's session ended on its own (16–18/11/2026: the children were asked for their PIN
 * on reopening Edge and in the middle of work). When the server sees a Supabase auth cookie but
 * cannot get the user, it notes the reason in a small httpOnly cookie; the next PIN login writes
 * it into the journal, so the parents (and we) can see what really happens. PURE.
 */

/** httpOnly cookie holding the FIRST unexplained loss since the last login. */
export const AUTH_LOST_COOKIE = "sl_auth_lost";
export const AUTH_LOST_MAX_AGE = 7 * 24 * 3600;

export interface AuthLost {
  /** Supabase Auth error code (e.g. refresh_token_already_used), or "unknown". */
  code: string;
  /** ISO time the server noticed. */
  at: string;
  /** Where: "/today", "/api/today"… (path only, never a query). */
  path: string;
}

/** True when the request carries a Supabase session cookie (sb-<ref>-auth-token, maybe chunked). */
export function hasAuthCookie(names: readonly string[]): boolean {
  return names.some((n) => /^sb-[a-z0-9]+-auth-token(\.\d+)?$/i.test(n));
}

/** A short, safe code from whatever supabase-js returned. */
export function lostCode(error: unknown): string {
  const e = error as { code?: unknown; name?: unknown; status?: unknown } | null;
  const raw = typeof e?.code === "string" && e.code ? e.code : typeof e?.name === "string" && e.name ? e.name : "unknown";
  return raw.replace(/[^A-Za-z0-9_]/g, "").slice(0, 48) || "unknown";
}

export function encodeLost(l: AuthLost): string {
  return encodeURIComponent(JSON.stringify(l));
}

export function decodeLost(raw: string | undefined): AuthLost | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as Partial<AuthLost>;
    if (typeof v.code !== "string" || typeof v.at !== "string" || typeof v.path !== "string") return null;
    return { code: v.code.slice(0, 48), at: v.at.slice(0, 40), path: v.path.slice(0, 80) };
  } catch {
    return null;
  }
}

/** The journal's words for a loss reason (Vietnamese). */
export function lostReasonText(code: string): string {
  switch (code) {
    case "refresh_token_already_used":
      return "phiên bị làm mới 2 lần cùng lúc";
    case "refresh_token_not_found":
    case "session_not_found":
      return "phiên đã bị hủy";
    case "session_expired":
      return "phiên hết hạn";
    case "AuthRetryableFetchError":
      return "mất kết nối tới máy chủ đăng nhập";
    default:
      return code;
  }
}
