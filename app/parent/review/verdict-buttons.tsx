"use client";

import { useState } from "react";
import { sendJson } from "@/lib/api-client";

type Verdict = "ok" | "not_ok" | null;

/** "Đạt" / "Chưa đạt", saved immediately (SPEC 2.6). Tapping the active one clears it. */
export function VerdictButtons({ runId, initial, label }: { runId: string; initial: Verdict; label: string }) {
  const [verdict, setVerdict] = useState<Verdict>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(v: Exclude<Verdict, null>) {
    const next = verdict === v ? null : v;
    const prev = verdict;
    setVerdict(next);
    setBusy(true);
    setError(null);
    const err = await sendJson("PATCH", `/api/admin/runs/${runId}`, { verdict: next });
    setBusy(false);
    if (err) {
      setVerdict(prev);
      setError(err);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div role="group" aria-label={`Đánh giá ${label}`} className="flex gap-2">
        <button
          type="button"
          aria-pressed={verdict === "ok"}
          disabled={busy}
          onClick={() => void choose("ok")}
          className={`min-h-11 rounded-full border px-4 text-sm font-bold ${verdict === "ok" ? "border-accent bg-accent text-white" : "border-ink/30 bg-white"}`}
        >
          Đạt
        </button>
        <button
          type="button"
          aria-pressed={verdict === "not_ok"}
          disabled={busy}
          onClick={() => void choose("not_ok")}
          className={`min-h-11 rounded-full border px-4 text-sm font-bold ${verdict === "not_ok" ? "border-[#8A2B1F] bg-[#8A2B1F] text-white" : "border-ink/30 bg-white"}`}
        >
          Chưa đạt
        </button>
      </div>
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
