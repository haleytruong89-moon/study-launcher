"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendJson } from "@/lib/api-client";

/**
 * "Khôi phục bản trước" (21/11/2026): undo one change the child made to their schedule. Two taps
 * (the second confirms) so a slip does not undo anything.
 */
export function RestoreButton({ auditId }: { auditId: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start">
      <button
        type="button"
        disabled={busy}
        className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold disabled:opacity-60 ${armed ? "bg-[#8E2F1D] text-white" : "border-[1.5px] border-[#8E2F1D] text-[#8E2F1D]"}`}
        onClick={async () => {
          if (!armed) {
            setArmed(true);
            setError(null);
            return;
          }
          setBusy(true);
          const err = await sendJson("POST", "/api/admin/schedule/restore", { auditId });
          setBusy(false);
          setArmed(false);
          if (err) setError(err);
          else router.refresh();
        }}
      >
        {busy ? "Đang khôi phục…" : armed ? "Bấm lần nữa để khôi phục" : "Khôi phục bản trước"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
