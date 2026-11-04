"use client";

import { useEffect, useState } from "react";
import { desktopBrowser } from "@/lib/ext/browser";

const PAGE = "study-launcher-page";
const EXT = "study-launcher-ext";
/** Ping the extension's content script this often, and give up after WAIT_MS. */
const PING_EVERY_MS = 1500;
const WAIT_MS = 6000;
const SEEN_KEY = "sl-ext-missing-noted";

/**
 * S6 (01/11/2026): on a desktop Chrome / Edge, checks that the Study Launcher extension
 * answers on this page (same ping as /ghep-may). No answer within a few seconds -> tells the
 * server, which notifies the parents at most once a day. Phones / iPad never check (no
 * extension possible there). The child sees a short, honest note — nothing is hidden.
 */
export function ExtensionCheck() {
  const [noted, setNoted] = useState(false);

  useEffect(() => {
    if (!desktopBrowser(navigator.userAgent)) return;
    let answered = false;
    let cancelled = false;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window || e.origin !== window.location.origin) return;
      const d = e.data as { source?: string; type?: string } | null;
      if (d?.source === EXT && d.type === "pong") answered = true;
    };
    window.addEventListener("message", onMessage);
    const ping = () => window.postMessage({ source: PAGE, type: "ping" }, window.location.origin);
    ping();
    const pinger = window.setInterval(() => (answered ? window.clearInterval(pinger) : ping()), PING_EVERY_MS);
    const timer = window.setTimeout(async () => {
      window.clearInterval(pinger);
      if (answered || cancelled) return;
      try {
        if (window.sessionStorage.getItem(SEEN_KEY) === "1") return setNoted(true);
      } catch {
        /* storage blocked: ask the server, it rate-limits anyway */
      }
      try {
        const res = await fetch("/api/ext/missing", { method: "POST" });
        const data = (await res.json().catch(() => null)) as { status?: string } | null;
        if (cancelled || !res.ok) return;
        if (data?.status === "reported" || data?.status === "already") {
          setNoted(true);
          try {
            window.sessionStorage.setItem(SEEN_KEY, "1");
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* offline: nothing to do */
      }
    }, WAIT_MS);
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
      window.clearInterval(pinger);
      window.clearTimeout(timer);
    };
  }, []);

  if (!noted) return null;
  return (
    <p role="status" aria-label="Extension" className="bg-[#F7E4E0] px-4 py-2 text-center text-sm font-semibold text-[#8A2B1F]">
      Trình duyệt này chưa có extension Study Launcher (hoặc extension đang tắt) — bố mẹ đã được báo.
    </p>
  );
}
