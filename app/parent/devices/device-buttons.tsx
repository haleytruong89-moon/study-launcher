"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { sendJson } from "@/lib/api-client";

/** Shows a fresh 6-digit code once, with a countdown (10 minutes). */
export function PairCodeButton({ childId, name }: { childId: string; name: string }) {
  const [code, setCode] = useState<{ code: string; expiresAt: number } | null>(null);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    const tick = () => setLeft(Math.max(0, Math.round((code.expiresAt - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [code]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/devices/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childId }) });
      const data = (await res.json().catch(() => null)) as { code?: string; expiresAt?: string; error?: string } | null;
      if (!res.ok || !data?.code || !data.expiresAt) setError(data?.error ?? "Có lỗi, thử lại.");
      else setCode({ code: data.code, expiresAt: new Date(data.expiresAt).getTime() });
    } catch {
      setError("Mất kết nối mạng, thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {code && left > 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-xl bg-[#E3ECE7] p-3" aria-live="polite">
          <span className="text-xs font-semibold text-ink/75">Mã ghép máy của {name}</span>
          <span className="text-4xl font-bold tracking-[0.25em] tabular-nums" aria-label={`Mã ${code.code.split("").join(" ")}`}>
            {code.code}
          </span>
          <span className="text-xs text-ink/70">
            Còn {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} · dùng 1 lần
          </span>
        </div>
      ) : (
        <button type="button" disabled={busy} onClick={() => void create()} className="btn self-start border border-accent bg-white text-accent disabled:opacity-60">
          {busy ? "Đang tạo…" : code ? "Mã đã hết hạn — tạo mã mới" : "Tạo mã ghép máy"}
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

export function RevokeButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={`Gỡ máy ${label}`}
      onClick={async () => {
        if (!window.confirm(`Gỡ “${label}”? Extension trên máy đó sẽ khóa web cho tới khi ghép lại.`)) return;
        setBusy(true);
        const err = await sendJson("PATCH", `/api/admin/devices/${id}`, { revoked: true });
        setBusy(false);
        if (err) window.alert(err);
        else router.refresh();
      }}
      className="min-h-11 rounded-lg px-2 text-sm font-semibold text-[#8A2B1F] disabled:opacity-60"
    >
      Gỡ máy
    </button>
  );
}
