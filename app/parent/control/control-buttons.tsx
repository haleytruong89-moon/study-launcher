"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendJson } from "@/lib/api-client";
import { EXTEND_CHOICES, LOCK_CHOICES, OPEN_CHOICES, type OverrideAction } from "@/lib/admin/override";

const label = (m: number | null) => (m === null ? "đến hết hôm nay" : m >= 60 ? `${m / 60} giờ` : `${m} phút`);

/** Big buttons for the parent's phone. Every action asks once before sending. */
export function ControlButtons({ childId, name, open, override }: { childId: string; name: string; open: boolean; override: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reason, setReason] = useState("");

  async function send(action: OverrideAction, minutes: number | null, confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    setMsg(null);
    const err = await sendJson("POST", "/api/admin/overrides", { childId, action, minutes, reason: reason.trim() || null });
    setBusy(false);
    if (err) return setMsg({ ok: false, text: err });
    setMsg({ ok: true, text: "Đã gửi. Máy của con đổi trong khoảng 1 phút." });
    setReason("");
    router.refresh();
  }

  const chip = "min-h-11 rounded-full border px-4 text-sm font-semibold disabled:opacity-50";
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={`Mở máy cho ${name}`} className="flex flex-col gap-1.5">
        <span className="text-xs font-bold tracking-wider text-ink/70 uppercase">Mở mọi trang</span>
        <div className="flex flex-wrap gap-2">
          {OPEN_CHOICES.map((m) => (
            <button key={String(m)} type="button" disabled={busy} onClick={() => void send("open", m, `Mở mọi trang cho ${name} ${label(m)}?`)} className={`${chip} border-[#7A400B]/40 bg-[#FBE9D3] text-[#5E3108]`}>
              Mở {label(m)}
            </button>
          ))}
        </div>
      </div>
      {open && (
        <div role="group" aria-label={`Cộng thêm phút cho ${name}`} className="flex flex-col gap-1.5">
          <span className="text-xs font-bold tracking-wider text-ink/70 uppercase">Cộng thêm (đang mở)</span>
          <div className="flex flex-wrap gap-2">
            {EXTEND_CHOICES.map((m) => (
              <button key={m} type="button" disabled={busy} onClick={() => void send("extend", m, `Cộng thêm ${m} phút mở máy cho ${name}?`)} className={`${chip} border-ink/25 bg-white`}>
                +{m} phút
              </button>
            ))}
          </div>
        </div>
      )}
      <div role="group" aria-label={`Khóa máy của ${name}`} className="flex flex-col gap-1.5">
        <span className="text-xs font-bold tracking-wider text-ink/70 uppercase">Chỉ mở trang học</span>
        <div className="flex flex-wrap gap-2">
          {LOCK_CHOICES.map((m) => (
            <button key={String(m)} type="button" disabled={busy} onClick={() => void send("lock", m, `Khóa máy của ${name} ${label(m)}? (chỉ mở trang học)`)} className={`${chip} border-ink bg-ink text-white`}>
              Khóa {label(m)}
            </button>
          ))}
        </div>
      </div>
      {override && (
        <button type="button" disabled={busy} onClick={() => void send("clear", null, `Bỏ lệnh mở/khóa của bố mẹ, để máy ${name} về bình thường?`)} className={`${chip} self-start border-accent bg-white text-accent`}>
          Về bình thường
        </button>
      )}
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Lý do (tùy chọn, ghi vào nhật ký)
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Ví dụ: tra cứu bài KHTN" className="min-h-11 rounded-xl border border-ink/30 bg-white px-3 text-base font-normal" />
      </label>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm font-semibold ${msg.ok ? "text-accent" : "text-red-700"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
