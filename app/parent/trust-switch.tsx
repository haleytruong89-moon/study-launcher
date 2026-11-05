"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendJson } from "@/lib/api-client";
import { MODE_LABEL } from "@/lib/admin/trust";
import type { TrustMode } from "@/lib/dayState";

/**
 * Manual switch Khóa ⇄ Tin tưởng in "Các con" (SPEC section 7: the parent may switch either way
 * at any time). Two steps: tap, read what changes, confirm.
 */
export function TrustSwitch({ childId, name, mode, since }: { childId: string; name: string; mode: TrustMode; since: string | null }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const next: TrustMode = mode === "trust" ? "lock" : "trust";

  async function confirm() {
    setBusy(true);
    setError(null);
    const err = await sendJson("POST", "/api/admin/trust", { childId, mode: next, via: "manual" });
    setBusy(false);
    if (err) return setError(err);
    setAsking(false);
    setNotice(`Đã chuyển ${name} sang chế độ ${MODE_LABEL[next]}. Laptop của con đổi trong khoảng 1 phút.`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 border-t border-ink/10 pt-3" aria-label={`Chế độ của ${name}`} role="group">
      <p className="text-sm">
        Chế độ hiện tại: <strong>{MODE_LABEL[mode]}</strong>
        {since ? <span className="text-ink/70"> · từ {since}</span> : null}
      </p>
      {!asking ? (
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setAsking(true);
          }}
          className="min-h-11 self-start rounded-xl border-[1.5px] border-accent bg-white px-3 text-sm font-bold text-accent"
        >
          {next === "trust" ? "Chuyển sang chế độ Tin tưởng…" : "Chuyển về chế độ Khóa…"}
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl bg-[#E3EEEA] p-3">
          <p className="text-sm font-bold">
            {next === "trust"
              ? `Chuyển ${name} sang Tin tưởng: laptop mở mọi trang ngay cả khi chưa xong việc; Launcher vẫn hiện việc hôm nay và nhắc nhở.`
              : `Chuyển ${name} về Khóa: laptop lại chỉ mở trang học cho đến khi xong việc.`}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => void confirm()} className="min-h-11 rounded-xl bg-accent px-2 text-sm font-extrabold text-white disabled:opacity-60">
              {next === "trust" ? "Xác nhận: Tin tưởng" : "Xác nhận: Khóa"}
            </button>
            <button type="button" disabled={busy} onClick={() => setAsking(false)} className="min-h-11 rounded-xl border border-ink/30 bg-white px-2 text-sm font-bold">
              Hủy
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm font-semibold text-accent">
          {notice}
        </p>
      )}
    </div>
  );
}
