"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isChildTab, tabHref, type ChildTab } from "@/lib/childTabs";

export type Tab = Exclude<ChildTab, "binh-yen">;

function tabFromUrl(): Tab {
  const t = new URLSearchParams(window.location.search).get("tab");
  return isChildTab(t) ? t : "hom-nay";
}

/**
 * R2: the 5 tabs. Hôm nay / Góc học tập / Tuần / Góp ý share the Today screen (and its state).
 * `loadWeekRef` is set later by useWeekDays (a tab change re-reads the week where it is shown).
 */
export function useChildTabs(initialTab: Tab) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const tabRef = useRef<Tab>(initialTab);
  // R6c: "Chỉ hiện bài này" of Góc học tập (off again whenever the tab changes).
  const [studyFocus, setStudyFocus] = useState(false);
  // R6c "← Quay lại": the tabs the child came from (last 10), falling back to Hôm nay.
  const [tabHistory, setTabHistory] = useState<Tab[]>([]);
  const loadWeekRef = useRef<() => Promise<void>>(async () => {});
  const selectTab = useCallback((t: Tab, opts?: { back?: boolean }) => {
    if (t === tabRef.current) return;
    if (!opts?.back) {
      const from = tabRef.current;
      setTabHistory((h) => [...h, from].slice(-10));
    }
    tabRef.current = t;
    setTab(t);
    setStudyFocus(false);
    window.history.pushState(null, "", tabHref(t));
    window.scrollTo({ top: 0 });
    void loadWeekRef.current();
  }, []);
  useEffect(() => {
    const onPop = () => {
      tabRef.current = tabFromUrl();
      setTab(tabRef.current);
      setStudyFocus(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return { tab, tabRef, studyFocus, setStudyFocus, tabHistory, setTabHistory, loadWeekRef, selectTab };
}
