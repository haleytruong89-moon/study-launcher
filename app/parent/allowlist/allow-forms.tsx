"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendJson } from "@/lib/api-client";

interface Kid {
  id: string;
  name: string;
  color: string | null;
}

const chip = (on: boolean) => `min-h-11 rounded-full border px-4 text-sm font-semibold ${on ? "border-ink bg-ink text-white" : "border-ink/30 bg-white"}`;

/** Add a site: domain or pasted link, for one child or both, always or until tonight. */
export function AllowAddForm({ kids }: { kids: Kid[] }) {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [childId, setChildId] = useState<string | null>(null);
  const [duration, setDuration] = useState<"permanent" | "today">("permanent");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const err = await sendJson("POST", "/api/admin/allowlist", { domain, childId, duration });
    setBusy(false);
    if (err) return setMsg({ ok: false, text: err });
    setMsg({ ok: true, text: "Đã thêm. Máy của con cập nhật trong khoảng 30 giây." });
    setDomain("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} aria-label="Thêm trang học" className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
      <label className="flex flex-col gap-1 text-sm font-bold">
        Trang (tên miền hoặc dán link)
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="vd meet.google.com"
          required
          className="min-h-11 rounded-xl border border-ink/30 px-3 text-base font-normal"
        />
      </label>
      <div role="group" aria-label="Cho con nào" className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={childId === null} onClick={() => setChildId(null)} className={chip(childId === null)}>
          Cả 2 con
        </button>
        {kids.map((k) => (
          <button key={k.id} type="button" aria-pressed={childId === k.id} onClick={() => setChildId(k.id)} className={chip(childId === k.id)}>
            {k.name}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Thời hạn" className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={duration === "permanent"} onClick={() => setDuration("permanent")} className={chip(duration === "permanent")}>
          Luôn luôn
        </button>
        <button type="button" aria-pressed={duration === "today"} onClick={() => setDuration("today")} className={chip(duration === "today")}>
          Đến hết hôm nay
        </button>
      </div>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm font-semibold ${msg.ok ? "text-accent" : "text-red-700"}`}>
          {msg.text}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn bg-accent text-white disabled:opacity-60">
        {busy ? "Đang lưu…" : "Thêm trang"}
      </button>
    </form>
  );
}

export function AllowRemoveButton({ id, domain }: { id: string; domain: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={`Bỏ ${domain}`}
      onClick={async () => {
        if (!window.confirm(`Bỏ “${domain}” khỏi danh sách?`)) return;
        setBusy(true);
        try {
          const res = await fetch(`/api/admin/allowlist/${id}`, { method: "DELETE" });
          if (!res.ok) window.alert(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Không xóa được.");
        } finally {
          setBusy(false);
          router.refresh();
        }
      }}
      className="min-h-11 rounded-lg px-2 text-sm font-semibold text-[#8A2B1F] disabled:opacity-60"
    >
      Bỏ
    </button>
  );
}
