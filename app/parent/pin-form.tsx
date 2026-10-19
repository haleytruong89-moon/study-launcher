"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendJson } from "@/lib/api-client";
import { pinProblem } from "@/lib/pin/rules";

/** Parent sets / changes the child's 6-digit PIN for signing in on a remembered laptop. */
export function PinForm({ childId, name, pinSet }: { childId: string; name: string; pinSet: boolean }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="flex flex-col gap-2 rounded-xl bg-bg p-3"
      aria-label={`PIN của ${name}`}
      onSubmit={async (e) => {
        e.preventDefault();
        setSaved(false);
        const problem = pinProblem(pin);
        if (problem) return setError(problem);
        setError(null);
        setBusy(true);
        const err = await sendJson("POST", `/api/admin/children/${childId}/pin`, { pin });
        setBusy(false);
        if (err) return setError(err);
        setPin("");
        setSaved(true);
        router.refresh();
      }}
    >
      <span className="text-sm font-bold">PIN đăng nhập trên máy của con {pinSet ? "· đã đặt" : "· chưa đặt"}</span>
      <span className="text-xs text-ink/70">
        Con chọn tên mình rồi gõ 6 số, thay cho email + mật khẩu dài. Chỉ dùng được trên máy con đã đăng nhập bằng email ít nhất một lần. Sai 5 lần thì khóa 15 phút.
      </span>
      <div className="flex gap-2">
        <label className="flex grow flex-col gap-1 text-sm font-semibold">
          <span className="sr-only">PIN 6 số mới</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            pattern="\d{6}"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder={pinSet ? "PIN mới (6 số)" : "6 số"}
            aria-label="PIN 6 số mới"
            className="min-h-11 rounded-xl border border-ink/30 bg-white px-3 text-lg tracking-[0.3em]"
          />
        </label>
        <button type="submit" disabled={busy || pin.length !== 6} className="btn shrink-0 bg-accent text-white disabled:opacity-50">
          {pinSet ? "Đổi PIN" : "Lưu PIN"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm font-semibold text-accent">
          Đã lưu PIN. Nhắc con nhớ, đừng ghi lên máy.
        </p>
      )}
    </form>
  );
}
