"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TodayView } from "@/lib/today/service";

/**
 * Server clock offset: countdowns use server time, never the laptop clock alone. `accept` shows a
 * view from the server and re-reads the offset from its serverNow.
 */
export function useServerClock(initial: TodayView | null, setView: (v: TodayView) => void) {
  const offsetRef = useRef(0);
  const [nowMs, setNowMs] = useState(() => (initial ? new Date(initial.state.serverNow).getTime() : 0));
  useEffect(() => {
    if (initial) offsetRef.current = new Date(initial.state.serverNow).getTime() - Date.now();
  }, [initial]);

  const accept = useCallback(
    (v: TodayView) => {
      offsetRef.current = new Date(v.state.serverNow).getTime() - Date.now();
      setView(v);
      setNowMs(Date.now() + offsetRef.current);
    },
    [setView],
  );
  return { offsetRef, nowMs, setNowMs, accept };
}
