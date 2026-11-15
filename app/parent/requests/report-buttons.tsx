"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendJson } from "@/lib/api-client";

/** "Đồng ý" / "Không đúng" for a "Con quên bấm Bắt đầu?" report (15/11/2026). */
export function ReportButtons({ reportId, label }: { reportId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (decision: "approve" | "reject") => {
    setBusy(true);
    setError(null);
    const err = await sendJson("POST", `/api/admin/run-reports/${reportId}`, { decision });
    setBusy(false);
    if (err) setError(err);
    router.refresh();
  };
  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label={`Xác nhận lượt ${label}`} className="grid grid-cols-[2fr_1fr] gap-2">
        <button type="button" disabled={busy} onClick={() => void send("approve")} className="min-h-12 rounded-xl bg-accent font-bold text-white disabled:opacity-60">
          Đồng ý
        </button>
        <button type="button" disabled={busy} onClick={() => void send("reject")} className="min-h-12 rounded-xl border border-ink/30 bg-white font-bold disabled:opacity-60">
          Không đúng
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
