/**
 * "Báo bố mẹ khi extension bị gỡ" (S6, 01/11/2026). When the extension is removed, the browser
 * opens the address given to chrome.runtime.setUninstallURL in a normal tab. That address is
 * seen by the child (history, address bar), so it must NEVER contain the device token: it
 * carries the token's SHA-256 instead, which the server already stores (token_hash) and which
 * cannot be used to read the state (the server only accepts the token itself as a Bearer).
 */

/** Chrome refuses uninstall URLs longer than this. */
export const UNINSTALL_URL_MAX = 1023;

export function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = "";
  for (const b of view) out += b.toString(16).padStart(2, "0");
  return out;
}

/** SHA-256 of the device token, lowercase hex (same as the server's hashToken). */
export async function tokenProof(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(digest);
}

/**
 * The uninstall address for a paired extension, or "" (= open nothing) when not paired or
 * when the inputs look wrong. Only https (or a local test server) on the build-time Launcher.
 */
export function uninstallUrl(launcherUrl: string, proof: string | null): string {
  if (!proof || !/^[0-9a-f]{64}$/.test(proof)) return "";
  let origin: URL;
  try {
    origin = new URL(launcherUrl);
  } catch {
    return "";
  }
  if (origin.protocol !== "https:" && origin.hostname !== "localhost") return "";
  const url = `${origin.origin}/api/ext/uninstalled?k=${proof}`;
  return url.length <= UNINSTALL_URL_MAX ? url : "";
}
