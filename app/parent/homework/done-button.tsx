"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendJson } from "@/lib/api-client";

/**
 * "✓ Con đã làm" (21/11/2026): the parent saw the homework done on paper, away from the
 * computer. Two taps (the second confirms) so a slip does not mark it. Done now, "Đạt".
 */
export function DoneButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mr-auto flex flex-col items-start">
      <button
        type="button"
        disabled={busy}
        aria-label={armed ? `Bấm lần nữa: ${label} con đã làm` : `Con đã làm bài ${label}`}
        className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold disabled:opacity-60 ${armed ? "bg-[#1F6B45] text-white" : "border-[1.5px] border-[#1F6B45] text-[#1F6B45]"}`}
        onClick={async () => {
          if (!armed) {
            setArmed(true);
            setError(null);
            return;
          }
          setBusy(true);
          const err = await sendJson("POST", `/api/admin/homework/${id}/done`, {});
          setBusy(false);
          setArmed(false);
          if (err) setError(err);
          else router.refresh();
        }}
      >
        {busy ? "Đang lưu…" : armed ? "Bấm lần nữa để xác nhận" : "✓ Con đã làm"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
