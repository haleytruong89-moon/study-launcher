"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { WeekDaysView } from "@/lib/today/weekDays";
import type { Tab } from "./use-child-tabs";

/** The child's own week (feelings + 4 areas): a child-only route, never part of TodayView. */
export function useWeekDays(tabRef: RefObject<Tab>, loadWeekRef: RefObject<() => Promise<void>>) {
  const [week, setWeek] = useState<WeekDaysView | null>(null);
  const weekAt = useRef(0);
  // Fetched only where it is shown (Hôm nay, Tuần), at most once a minute unless forced.
  const loadWeek = useCallback(async (force = false) => {
    if (tabRef.current !== "hom-nay" && tabRef.current !== "tuan") return;
    if (!force && Date.now() - weekAt.current < 60_000) return;
    weekAt.current = Date.now();
    try {
      const res = await fetch("/api/week/days", { cache: "no-store" });
      if (res.ok) setWeek((await res.json()) as WeekDaysView);
    } catch {
      /* the chart just waits for the next try */
    }
  }, [tabRef]);

  useEffect(() => {
    loadWeekRef.current = () => loadWeek();
  }, [loadWeek, loadWeekRef]);

  useEffect(() => {
    let alive = true;
    weekAt.current = Date.now();
    fetch("/api/week/days", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<WeekDaysView>) : null))
      .then((w) => {
        if (alive && w) setWeek(w);
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, []);
  return { week, loadWeek };
}
