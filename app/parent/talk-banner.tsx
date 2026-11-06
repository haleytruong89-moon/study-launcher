"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Red banner on every parent page while a child's "Con muốn nói chuyện" waits for "Đã thấy"
 * (Góc bình yên, S-BY0). Re-read every 20 s while the page is visible.
 */
export function TalkBanner({ initial }: { initial: number }) {
  const [n, setN] = useState(initial);
  // A server refresh (e.g. after "Đã thấy") brings a new count: take it at once.
  const [given, setGiven] = useState(initial);
  if (given !== initial) {
    setGiven(initial);
    setN(initial);
  }
  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/admin/talk/count", { cache: "no-store" });
        if (r.ok) setN(((await r.json()) as { unseen: number }).unseen);
      } catch {
        /* keep the last number */
      }
    };
    const id = window.setInterval(() => void tick(), 20_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  if (n <= 0) return null;
  return (
    <Link href="/parent/talk" className="flex min-h-12 items-center gap-2 bg-[#B42318] px-4 text-sm font-bold text-white">
      <span aria-hidden>💬</span>
      <span className="grow">{n === 1 ? "Con muốn nói chuyện với bố mẹ" : `${n} lần con muốn nói chuyện`}</span>
      <span aria-label={`${n} tín hiệu chưa xem`} className="inline-flex min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs text-[#B42318]">
        {n}
      </span>
      <span aria-hidden>›</span>
    </Link>
  );
}
