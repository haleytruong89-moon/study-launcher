/**
 * The Launcher lock page URL: `<launcher origin>/blocked?u=<original URL>`
 * (docs/DESIGN.md section 7).
 *
 * The original URL is appended RAW (not percent-encoded), exactly like the DNR
 * `regexSubstitution` redirect does, so the tab sweep and the DNR redirect land on
 * identical URLs. The lock page must therefore read EVERYTHING after `?u=`
 * (including any `&`, `?` and `#`) from the full href, never `searchParams.get`.
 *
 * Safety note for the lock page (S4b): the parsed value is untrusted text typed
 * by / navigated to by the child. Never render it as a link unless it is http(s).
 */

export const BLOCKED_PATH = "/blocked";
const MARKER = `${BLOCKED_PATH}?u=`;

/** Origin of the launcher (`https://host[:port]`), or null if not an http(s) URL. */
export function launcherOrigin(launcherUrl: string): string | null {
  try {
    const u = new URL(launcherUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** Builds the lock-page URL for `originalUrl`. Throws if launcherUrl is invalid. */
export function buildBlockedUrl(launcherUrl: string, originalUrl: string): string {
  const origin = launcherOrigin(launcherUrl);
  if (origin === null) throw new Error(`invalid launcher URL: ${launcherUrl}`);
  return `${origin}${MARKER}${originalUrl}`;
}

/**
 * Extracts the original URL from a lock-page href. Returns null when `href` is
 * not a `/blocked?u=` URL or the value is empty. Works on the raw href and on
 * the browser-normalised one (`new URL(built).href`).
 */
export function parseBlockedUrl(href: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    return null;
  }
  if (parsed.pathname !== BLOCKED_PATH || !parsed.search.startsWith("?u=")) return null;
  const at = href.indexOf(MARKER);
  if (at < 0) return null;
  const value = href.slice(at + MARKER.length);
  return value.length > 0 ? value : null;
}
