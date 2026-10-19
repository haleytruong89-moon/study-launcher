"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendJson } from "@/lib/api-client";
import { CHILD_COLORS } from "@/lib/childColors";
import { PinForm } from "./pin-form";

interface Child {
  id: string;
  displayName: string;
  grade: number | null;
  color: string | null;
}

/** Edit a child's name / grade / colour, and reset the password (shown once). */
export function ChildEdit({ child, pinSet = false }: { child: Child; pinSet?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(child.displayName);
  const [grade, setGrade] = useState(String(child.grade ?? ""));
  const [color, setColor] = useState(child.color ?? CHILD_COLORS[0].value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);

  const colors: { value: string; label: string }[] = CHILD_COLORS.some((c) => c.value === color)
    ? [...CHILD_COLORS]
    : [{ value: color, label: "Màu hiện tại" }, ...CHILD_COLORS];

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    const err = await sendJson("PATCH", `/api/admin/children/${child.id}`, { displayName: name, grade: Number(grade), color });
    setBusy(false);
    if (err) return setError(err);
    setSaved(true);
    router.refresh();
  }

  async function resetPassword() {
    if (!window.confirm(`Đặt lại mật khẩu của ${child.displayName}? Máy của con sẽ cần đăng nhập lại bằng mật khẩu mới.`)) return;
    setError(null);
    setCreds(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/children/${child.id}/password`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as { error?: string; email?: string; password?: string } | null;
      if (!res.ok || !body?.password || !body.email) setError(body?.error ?? "Có lỗi, thử lại sau.");
      else setCreds({ email: body.email, password: body.password });
    } catch {
      setError("Mất kết nối mạng, thử lại sau.");
    } finally {
      setBusy(false);
    }
  }

  const input = "min-h-11 rounded-xl border border-ink/30 bg-white px-3 text-base font-normal";
  return (
    <div className="flex flex-col gap-4 pt-3">
      <form onSubmit={save} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Tên của con
          <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Lớp của con
          <input type="number" required min={1} max={12} value={grade} onChange={(e) => setGrade(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Màu của con
          <select value={color} onChange={(e) => setColor(e.target.value)} className={input}>
            {colors.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={busy} className="btn bg-accent text-white disabled:opacity-60">
          Lưu thông tin
        </button>
      </form>

      <button type="button" disabled={busy} onClick={resetPassword} className="btn border border-ink/25 bg-white disabled:opacity-60">
        Đặt lại mật khẩu
      </button>

      <PinForm childId={child.id} name={child.displayName} pinSet={pinSet} />

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm font-semibold text-accent">
          Đã lưu.
        </p>
      )}
      {creds && (
        <div role="status" className="rounded-xl border border-accent/40 bg-bg p-3 text-sm">
          <p className="font-semibold">Mật khẩu mới — chỉ hiện một lần. Lưu ngay, đừng chụp gửi ai.</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-ink/60">Email</dt>
            <dd className="font-mono break-all">{creds.email}</dd>
            <dt className="text-ink/60">Mật khẩu</dt>
            <dd className="font-mono break-all">{creds.password}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
