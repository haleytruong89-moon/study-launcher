"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Preset } from "@/lib/admin/presets";

/** One tap adds a whole bundle (e.g. Google Meet) for both children, always. */
export function PresetButtons({ presets, have }: { presets: readonly Preset[]; have: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const present = new Set(have);

  async function add(p: Preset) {
    setBusy(p.id);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/allowlist/preset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preset: p.id }) });
      const d = (await r.json().catch(() => null)) as { error?: string; added?: string[] } | null;
      if (!r.ok) setMsg({ ok: false, text: d?.error ?? "Có lỗi, thử lại." });
      else setMsg({ ok: true, text: d?.added?.length ? `Đã thêm ${p.label} (${d.added.length} trang) cho cả 2 con. Máy con cập nhật trong khoảng 30 giây.` : `${p.label} đã có đủ rồi.` });
    } catch {
      setMsg({ ok: false, text: "Mất kết nối mạng, thử lại." });
    }
    setBusy(null);
    router.refresh();
  }

  return (
    <section aria-labelledby="preset-h" className="flex flex-col gap-2">
      <h2 id="preset-h" className="text-base font-bold">
        Thêm nhanh
      </h2>
      <ul className="flex flex-col gap-2">
        {presets.map((p) => {
          const done = p.domains.every((d) => present.has(d));
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3">
              <div className="flex min-w-0 grow flex-col">
                <span className="font-bold">{p.label}</span>
                <span className="text-xs text-ink/70">{p.sub}</span>
                <span className="text-xs break-all text-ink/55">{p.domains.join(" · ")}</span>
              </div>
              {done ? (
                <span className="shrink-0 rounded-full bg-[#DDEBE5] px-3 py-2 text-xs font-bold text-[#1E443A]">✓ Đã có</span>
              ) : (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void add(p)}
                  aria-label={`Thêm ${p.label}`}
                  className="min-h-11 shrink-0 rounded-full bg-accent px-4 text-sm font-bold text-white disabled:opacity-60"
                >
                  {busy === p.id ? "Đang thêm…" : "Thêm"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm font-semibold ${msg.ok ? "text-accent" : "text-red-700"}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
