"use client";

import { useEffect, useState } from "react";

/** Red count of pending "Xin mở trang", refreshed every 30 s while the page is visible. */
export function RequestsBadge({ initial }: { initial: number }) {
  const [n, setN] = useState(initial);
  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/admin/requests/count", { cache: "no-store" });
        if (r.ok) setN(((await r.json()) as { pending: number }).pending);
      } catch {
        /* keep the last number */
      }
    };
    const id = window.setInterval(() => void tick(), 30_000);
    return () => window.clearInterval(id);
  }, []);
  if (n <= 0) return null;
  return (
    <span aria-label={`${n} yêu cầu đang chờ`} className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[#B42318] px-1.5 text-xs font-bold text-white">
      {n}
    </span>
  );
}
