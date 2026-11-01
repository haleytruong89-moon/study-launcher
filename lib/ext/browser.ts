/**
 * Which desktop browser a User-Agent belongs to, for "Launcher open without the extension"
 * (S6, 01/11/2026). Pure; used by the /today page AND re-checked by the server.
 *
 * Only desktop Chromium browsers can run our extension (Chrome, Edge, and Chromium-based
 * ones like Cốc Cốc / Opera / Brave, which install Chrome extensions too). Phones and tablets
 * can never have it, so they must never cause an alert:
 *  - iPhone / iPad Safari, and Chrome / Edge on iOS (CriOS / EdgiOS), have no "Chrome/x" token
 *    when they ask for the desktop site (iPadOS pretends to be a Mac Safari) -> not matched;
 *  - Android always says "Android" (or "Mobile") -> excluded.
 * Firefox / Safari on a computer are not matched either (no extension for them).
 */
export type DesktopBrowser = "Edge" | "Chrome" | "Cốc Cốc" | "Opera";

const MOBILE = /Android|Mobile|iPhone|iPad|iPod|CriOS|EdgiOS|FxiOS|OPiOS/i;
const DESKTOP_OS = /Windows NT|Macintosh|X11|CrOS|Linux x86_64/;

export function desktopBrowser(ua: string | null | undefined): DesktopBrowser | null {
  if (!ua || ua.length > 1000) return null;
  if (MOBILE.test(ua) || !DESKTOP_OS.test(ua)) return null;
  if (!/Chrome\/\d/.test(ua)) return null;
  if (/\bEdg\/\d/.test(ua)) return "Edge";
  if (/coc_coc_browser\//i.test(ua)) return "Cốc Cốc";
  if (/\bOPR\/\d/.test(ua)) return "Opera";
  return "Chrome";
}
