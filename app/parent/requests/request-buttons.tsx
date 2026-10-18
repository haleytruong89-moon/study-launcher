"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { sendJson } from "@/lib/api-client";

/** Re-renders the server page every N seconds while it is visible. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds]);
  return null;
}

const OPTIONS = [
  { decision: "15m", label: "Mở 15 phút" },
  { decision: "day", label: "Đến hết hôm nay" },
  { decision: "permanent", label: "Luôn cho phép" },
  { decision: "deny", label: "Không" },
] as const;

export function DecisionButtons({ id, domain }: { id: string; domain: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label={`Trả lời ${domain}`} className="grid grid-cols-2 gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.decision}
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const err = await sendJson("POST", `/api/admin/requests/${id}`, { decision: o.decision });
              setBusy(false);
              if (err) setError(err);
              router.refresh();
            }}
            className={`min-h-12 rounded-xl text-sm font-bold disabled:opacity-60 ${o.decision === "deny" ? "border border-ink/30 bg-white" : "bg-accent text-white"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
