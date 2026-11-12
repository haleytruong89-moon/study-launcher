"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, type RefObject } from "react";
import type { TodayView } from "@/lib/today/service";

const POLL_MS = 30_000;

/**
 * Keeps the Today view in step with the server: `refresh` re-reads /api/today, a 30 s poll while
 * visible (and right away when the tab comes back), and a 1-second tick for the timers that
 * re-reads the server when a deadline passes.
 */
export function useTodaySync({
  view,
  accept,
  loadWeek,
  setError,
  offsetRef,
  setNowMs,
}: {
  view: TodayView | null;
  accept: (v: TodayView) => void;
  loadWeek: () => Promise<void>;
  setError: (e: string | null) => void;
  offsetRef: RefObject<number>;
  setNowMs: (ms: number) => void;
}) {
  const router = useRouter();
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/today", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      accept((await res.json()) as TodayView);
      setError(null);
      void loadWeek();
    } catch {
      setError("Mất kết nối với máy chủ. Đang thử lại…");
    }
  }, [accept, router, loadWeek, setError]);

  // Remember this browser for the PIN sign-in (once per page load; best effort).
  useEffect(() => {
    void fetch("/api/pin/remember", { method: "POST" }).catch(() => null);
  }, []);

  // Poll every 30 s while visible, and right away when the tab comes back (DESIGN section 6).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  // 1-second tick for timers; re-read the server when a deadline passes.
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now() + offsetRef.current;
      setNowMs(t);
      const s = view?.state;
      const deadlines = [s?.openUntil, s?.break.endsAt, s?.free.endsAt].filter((x): x is string => !!x).map((x) => new Date(x).getTime());
      if (deadlines.some((d) => d <= t && d > t - 1000)) void refresh();
    }, 1000);
    return () => window.clearInterval(id);
  }, [view, refresh, offsetRef, setNowMs]);

  return refresh;
}

/**
 * Check often while something is in progress, so a photo sent from the phone or a parent's
 * confirmation shows here within seconds (the clock never keeps running after "done").
 * `fastMs` 0 = off.
 */
export function useFastPoll(fastMs: number, refresh: () => Promise<void>) {
  useEffect(() => {
    if (!fastMs) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, fastMs);
    return () => window.clearInterval(id);
  }, [fastMs, refresh]);
}
