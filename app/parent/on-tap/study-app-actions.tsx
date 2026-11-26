"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendJson } from "@/lib/api-client";

/** One app's buttons: try it, copy its address (for a task's Link), turn it on / off. */
export function StudyAppActions({ id, slug, active, url }: { id: string; slug: string; active: boolean; url: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    setError(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(`Không chép được, chép tay: ${url}`);
    }
  }

  async function toggle() {
    setError(null);
    setBusy(true);
    const err = await sendJson("PATCH", `/api/admin/study-apps/${id}`, { active: !active });
    setBusy(false);
    if (err) return setError(err);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {/* The app is a standalone page, not a Next.js route: plain <a>. */}
        <a href={`/on-tap/${slug}`} className="btn border border-ink/20 bg-white text-sm no-underline">
          Mở thử
        </a>
        <button type="button" onClick={() => void copy()} className="btn border border-ink/20 bg-white text-sm">
          {copied ? "Đã chép link ✓" : "Chép link"}
        </button>
        <button type="button" disabled={busy} onClick={() => void toggle()} className="btn border border-ink/20 bg-white text-sm">
          {busy ? "Đang lưu…" : active ? "Tắt app" : "Bật lại"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
