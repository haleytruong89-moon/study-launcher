/**
 * A same-site path to go to after login ("/ghep-may"), or null. Never another site.
 *
 * Browsers drop tabs/newlines and treat "\" like "/", so "/%09/evil.com" or "/\evil.com"
 * can turn into "//evil.com". We refuse any control character or backslash, then resolve
 * the value against a dummy origin and require it to stay on that origin.
 */
export function safeNext(value: string | null | undefined): string | null {
  if (!value || value.length > 2000) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (/[\u0000-\u001f\u007f\\]/.test(decoded) || decoded.startsWith("//")) return null;
  const base = "https://same.invalid";
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return null;
  }
  if (url.origin !== base) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
