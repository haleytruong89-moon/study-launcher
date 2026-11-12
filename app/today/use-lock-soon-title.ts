"use client";

import { useEffect } from "react";
import { lockSoonText } from "@/lib/today/view";

/**
 * D2 A2: in the last 5 minutes of a break / free time the tab title says so (the child may be
 * on another tab); the original title comes back afterwards. Minutes only, server clock.
 */
export function useLockSoonTitle(soonMinutes: number | null) {
  useEffect(() => {
    if (soonMinutes === null) return;
    const before = document.title;
    document.title = lockSoonText(soonMinutes).title;
    return () => {
      document.title = before;
    };
  }, [soonMinutes]);
}
