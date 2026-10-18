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

export function DecisionButtons({ id, domain, wide }: { id: string; domain: string; wide: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const decide = async (decision: string) => {
    setBusy(true);
    setError(null);
    const err = await sendJson("POST", `/api/admin/requests/${id}`, { decision });
    setBusy(false);
    if (err) setError(err);
    router.refresh();
  };
  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label={`Trả lời ${domain}`} className="grid grid-cols-2 gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.decision}
            type="button"
            disabled={busy}
            onClick={() => decide(o.decision)}
            className={`min-h-12 rounded-xl text-sm font-bold disabled:opacity-60 ${o.decision === "deny" ? "border border-ink/30 bg-white" : "bg-accent text-white"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {wide && (
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("permanent_base")}
          className="min-h-12 rounded-xl border-2 border-accent bg-white text-sm font-bold text-accent disabled:opacity-60"
        >
          Luôn cho phép cả {wide}
          <span className="block text-xs font-normal text-ink/70">mọi trang con của {wide}, không phải xin lại</span>
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
