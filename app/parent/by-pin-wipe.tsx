"use client";

import { useState } from "react";
import { sendJson } from "@/lib/api-client";

/**
 * Góc bình yên (Q1): the child sets their own PIN; a parent can ONLY wipe it, e.g. when the
 * child forgot it. The page never shows whether a PIN exists (that stays the child's).
 */
export function ByPinWipe({ childId, name }: { childId: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function wipe() {
    const ok = window.confirm(
      `Xóa PIN Góc bình yên của ${name}?\n\n• Những gì ${name} đã viết trong Góc bình yên trên máy của con sẽ bị xóa, không lấy lại được.\n• Lần sau mở Góc bình yên, con sẽ thấy: “PIN vừa được bố mẹ xóa lúc …”.\n• Con tự đặt PIN mới. Bố mẹ không biết và không đặt được PIN này.`,
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    setDone(false);
    const err = await sendJson("POST", `/api/admin/children/${childId}/by-pin`, {});
    setBusy(false);
    if (err) setError(err);
    else setDone(true);
  }

  return (
    <div aria-label={`Góc bình yên của ${name}`} role="group" className="flex flex-col gap-2 rounded-xl bg-bg p-3">
      <p className="text-sm">
        <strong>Góc bình yên:</strong> con tự đặt PIN riêng, bố mẹ không biết. Nếu con quên, bố mẹ chỉ có thể <strong>xóa</strong> PIN — chữ con viết trên máy sẽ bị xóa theo và con được báo.
      </p>
      <button type="button" disabled={busy} onClick={wipe} className="btn border border-ink/25 bg-white disabled:opacity-60">
        Xóa PIN Góc bình yên
      </button>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-sm font-semibold text-accent">
          Đã xóa. Lần sau mở Góc bình yên, con sẽ được báo và tự đặt PIN mới.
        </p>
      )}
    </div>
  );
}
