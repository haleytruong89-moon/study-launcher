"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PrepView } from "@/lib/schedule/prep";
import type { ExtraClass } from "@/lib/schedule/rules";
import type { DayPlan } from "@/lib/timetable/rules";

export type ExtraLine = { subject: string; start: string; end: string; place: string; bring: string };

/** GET /api/timetable (18/11/2026; extras + prep since 21/11/2026). */
export interface SchoolDay {
  has: boolean;
  today: DayPlan | null;
  next: DayPlan | null;
  extrasToday?: ExtraLine[];
  extrasNext?: ExtraLine[];
  extras?: ExtraClass[];
  prep?: PrepView | null;
  nowMs: number;
}

/**
 * One read of the child's school day, shared by the timetable card, "Chuẩn bị cho ngày mai" and
 * the "làm trước buổi học thêm" order (21/11/2026). Re-read every 15 minutes, and at once when the
 * day becomes complete (the checklist may then show before 19:00; the server checks it again).
 */
export function useSchoolDay(complete: boolean) {
  const [data, setData] = useState<SchoolDay | null>(null);
  const loadRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    let live = true;
    const load = () =>
      fetch(`/api/timetable${complete ? "?complete=1" : ""}`, { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<SchoolDay>) : null))
        .then((d) => {
          if (live && d) setData(d);
        })
        .catch(() => undefined);
    loadRef.current = () => void load();
    // First read, and again when the day becomes complete; then every 15 minutes.
    void load();
    const id = window.setInterval(() => void load(), 15 * 60_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [complete]);

  const reload = useCallback(() => loadRef.current(), []);

  /** After a tick: the server's answer replaces the ticks (no reload needed). */
  const setPrep = useCallback((ticked: string[], doneAt: string | null) => {
    setData((d) => (d?.prep ? { ...d, prep: { ...d.prep, ticked, doneAt, items: d.prep.items.map((i) => (i.auto ? i : { ...i, done: ticked.includes(i.key) })) } } : d));
  }, []);

  return { data, reload, setPrep };
}
