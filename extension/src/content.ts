/// <reference types="chrome" />
/**
 * Runs only on the Launcher's own pages (manifest content_scripts, fixed at build time).
 * Relays the pairing page's window.postMessage to the background worker and back.
 */
import { EXT_SOURCE, PAGE_SOURCE, TOKEN_RE } from "./config";

window.addEventListener("message", (e: MessageEvent) => {
  if (e.source !== window || e.origin !== window.location.origin) return;
  const d = e.data as { source?: string; type?: string; token?: unknown } | null;
  if (!d || d.source !== PAGE_SOURCE) return;
  const reply = (data: Record<string, unknown>) => window.postMessage({ source: EXT_SOURCE, ...data }, window.location.origin);
  if (d.type === "ping") {
    chrome.runtime
      .sendMessage({ type: "ping" })
      .then((r: { paired?: boolean } | undefined) => reply({ type: "pong", paired: r?.paired === true }))
      .catch(() => undefined);
  } else if (d.type === "pair" && typeof d.token === "string" && TOKEN_RE.test(d.token)) {
    chrome.runtime
      .sendMessage({ type: "pair", token: d.token })
      .then((r: { ok?: boolean } | undefined) => reply({ type: "paired", ok: r?.ok === true }))
      .catch(() => reply({ type: "paired", ok: false }));
  }
});
