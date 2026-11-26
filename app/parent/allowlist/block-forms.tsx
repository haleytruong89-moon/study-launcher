"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendJson } from "@/lib/api-client";

/** "Luôn chặn" (V1): add a site blocked in every state, for the whole family. */
export function BlockAddForm() {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const err = await sendJson("POST", "/api/admin/blocklist", { domain });
    setBusy(false);
    if (err) return setMsg({ ok: false, text: err });
    setMsg({ ok: true, text: "Đã chặn. Laptop của con cập nhật trong khoảng 30 giây." });
    setDomain("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} aria-label="Thêm trang luôn chặn" className="flex flex-wrap items-end gap-2">
      <label className="flex min-w-0 grow flex-col gap-1 text-sm font-bold">
        Chặn thêm trang
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="vd grok.com"
          required
          className="min-h-11 rounded-xl border border-ink/30 px-3 text-base font-normal"
        />
      </label>
      <button type="submit" disabled={busy} className="btn bg-[#8A2B1F] text-white disabled:opacity-60">
        {busy ? "Đang lưu…" : "Chặn"}
      </button>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`w-full text-sm font-semibold ${msg.ok ? "text-accent" : "text-red-700"}`}>
          {msg.text}
        </p>
      )}
    </form>
  );
}

export function BlockRemoveButton({ id, domain }: { id: string; domain: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={`Bỏ chặn ${domain}`}
      onClick={async () => {
        if (!window.confirm(`Bỏ chặn “${domain}”? Lúc máy mở, con sẽ vào được trang này.`)) return;
        setBusy(true);
        try {
          const res = await fetch(`/api/admin/blocklist/${id}`, { method: "DELETE" });
          if (!res.ok) window.alert(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Không xóa được.");
        } finally {
          setBusy(false);
          router.refresh();
        }
      }}
      className="min-h-11 rounded-lg px-2 text-sm font-semibold text-ink/70 disabled:opacity-60"
    >
      Bỏ chặn
    </button>
  );
}
