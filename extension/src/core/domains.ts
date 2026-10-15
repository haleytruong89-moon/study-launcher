/**
 * Hostname normalisation and allowlist matching (docs/DESIGN.md section 7,
 * docs/SPEC.md section 9). Pure, framework-free: no chrome.* calls, no clock.
 *
 * Matching rule (mirrors chrome.declarativeNetRequest `requestDomains`):
 * a domain entry allows itself and every subdomain of it, never its parent or
 * a look-alike. `translate.google.com` allows `translate.google.com` and
 * `x.translate.google.com`, but not `google.com`; `google.com` does not match
 * `evilgoogle.com`.
 *
 * Decisions where DESIGN/SPEC is silent (stricter option chosen):
 *  - Entries are normalised: lowercase, IDN -> punycode (same as the browser and
 *    DNR), scheme / path / port / userinfo / leading "*." / trailing dots removed.
 *    Unparseable entries are DROPPED (they never widen the allowlist).
 *  - Single-label entries (`com`, `vn`, `localhost`) are DROPPED from allow and
 *    block lists: an entry like `com` would open every .com site. The launcher host
 *    is passed separately and may be single-label (local dev).
 *  - Ports are ignored (DNR `requestDomains` ignores them too).
 *  - Non-http(s) URLs: browser-internal pages (chrome:, edge:, about:,
 *    chrome-extension:, devtools: ...) are never hijacked -> treated as allowed.
 *    `blob:` URLs follow the host of their inner origin. Everything else
 *    (`file:`, `data:`, `view-source:`, `ftp:`, `filesystem:`, `javascript:`,
 *    unknown schemes, unparseable strings) is NOT allowed while locked.
 *    Note: DNR cannot see `file:` navigations, so blocking them relies on the tab
 *    sweep / tab listeners (S4b).
 */

/** Built-in "always block while locked" domains, merged with the server list. */
export const BUILTIN_BLOCK_ALWAYS: readonly string[] = ["translate.goog"];

/** Schemes of browser-internal pages that must never be redirected. */
const INTERNAL_SCHEMES: ReadonlySet<string> = new Set([
  "chrome:",
  "edge:",
  "about:",
  "chrome-extension:",
  "extension:",
  "devtools:",
  "chrome-search:",
  "chrome-untrusted:",
]);

const LABEL_RE = /^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/;

function stripTrailingDots(host: string): string {
  return host.replace(/\.+$/, "");
}

/** Validates a canonical (already punycoded, lowercased) hostname. */
function isValidCanonicalHost(host: string): boolean {
  if (host.length === 0 || host.length > 253) return false;
  return host.split(".").every((label) => LABEL_RE.test(label));
}

/**
 * Normalises a hostname or a loosely written domain entry
 * (`https://Example.COM:8080/path`, `*.example.com`, `bücher.de.`) to the
 * canonical ASCII form used by the browser, or `null` when it is not a usable
 * DNS name / IPv4 address. IPv6 literals are rejected.
 */
export function normalizeHost(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (s.length === 0) return null;
  const schemeAt = s.indexOf("://");
  if (schemeAt >= 0) s = s.slice(schemeAt + 3);
  s = s.split(/[/?#\\]/, 1)[0] ?? "";
  const at = s.lastIndexOf("@");
  if (at >= 0) s = s.slice(at + 1);
  if (s.startsWith("[")) return null; // IPv6 literal
  s = s.replace(/:\d*$/, ""); // port
  s = s.replace(/^\*?\.+/, ""); // "*.example.com" / ".example.com"
  s = stripTrailingDots(s);
  if (s.length === 0 || s.includes(":")) return null;
  let hostname: string;
  try {
    hostname = new URL(`http://${s}/`).hostname;
  } catch {
    return null;
  }
  hostname = stripTrailingDots(hostname);
  return isValidCanonicalHost(hostname) ? hostname : null;
}

/**
 * Normalises a list of domain entries: drops invalid and single-label entries,
 * removes duplicates, sorts (stable rule output).
 */
export function normalizeDomainList(entries: readonly string[]): string[] {
  const out = new Set<string>();
  for (const entry of entries) {
    if (typeof entry !== "string") continue;
    const host = normalizeHost(entry);
    if (host !== null && host.includes(".")) out.add(host);
  }
  return [...out].sort();
}

/** `host` equals `domain` or is a subdomain of it. Both must be normalised. */
export function hostMatchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function hostMatchesAny(host: string, domains: readonly string[]): boolean {
  return domains.some((d) => hostMatchesDomain(host, d));
}

export type UrlClass =
  | { kind: "web"; host: string }
  | { kind: "internal" }
  | { kind: "other" };

/** Classifies a tab / navigation URL. See the header for the rules. */
export function classifyUrl(url: string): UrlClass {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: "other" };
  }
  const scheme = parsed.protocol;
  if (scheme === "http:" || scheme === "https:") {
    const host = normalizeHost(parsed.hostname);
    return host === null ? { kind: "other" } : { kind: "web", host };
  }
  if (INTERNAL_SCHEMES.has(scheme)) return { kind: "internal" };
  if (scheme === "blob:") {
    // blob:https://example.com/uuid -> same origin as the page that created it.
    const inner = classifyUrl(parsed.pathname);
    return inner.kind === "web" ? inner : { kind: "other" };
  }
  return { kind: "other" };
}

/**
 * Should this URL be reachable while the web is LOCKED?
 * Order mirrors the DNR rules: blockAlways (priority 3) beats the allowlist and
 * the launcher (priority 2); anything else is blocked (priority 1).
 * `allow` / `blockAlways` may be raw entries (they are normalised here);
 * `BUILTIN_BLOCK_ALWAYS` is always applied.
 */
export function isAllowed(
  url: string,
  allow: readonly string[],
  blockAlways: readonly string[],
  launcherHost: string,
): boolean {
  const c = classifyUrl(url);
  if (c.kind === "internal") return true;
  if (c.kind === "other") return false;
  const blocked = normalizeDomainList([...BUILTIN_BLOCK_ALWAYS, ...blockAlways]);
  if (hostMatchesAny(c.host, blocked)) return false;
  const launcher = normalizeHost(launcherHost);
  if (launcher !== null && hostMatchesDomain(c.host, launcher)) return true;
  return hostMatchesAny(c.host, normalizeDomainList(allow));
}
