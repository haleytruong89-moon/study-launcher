"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendJson } from "@/lib/api-client";
import { CHILD_COLORS } from "@/lib/childColors";
import { ByPinWipe } from "./by-pin-wipe";
import { PinForm } from "./pin-form";

interface Child {
  id: string;
  displayName: string;
  grade: number | null;
  color: string | null;
}

/** Edit a child's name / grade / colour, and reset the password (shown once). */
export function ChildEdit({ child, pinSet = false, remembered = 0 }: { child: Child; pinSet?: boolean; remembered?: number }) {
  const router = useRouter();
  const [name, setName] = useState(child.displayName);
  const [grade, setGrade] = useState(String(child.grade ?? ""));
  const [color, setColor] = useState(child.color ?? CHILD_COLORS[0].value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    if (!window.confirm(`Đặt lại mật khẩu của ${child.displayName}? Con sẽ bị đăng xuất khỏi mọi máy (trong vòng 1 giờ) và phải đăng nhập lại bằng mật khẩu mới.`)) return;
    setError(null);
    setNotice(null);
    setCreds(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/children/${child.id}/password`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as { error?: string; email?: string; password?: string; signedOut?: boolean } | null;
      if (!res.ok || !body?.password || !body.email) setError(body?.error ?? "Có lỗi, thử lại sau.");
      else {
        setCreds({ email: body.email, password: body.password });
        if (body.signedOut === false) setError("Mật khẩu mới đã dùng được, nhưng chưa đăng xuất được con khỏi các máy cũ. Bấm “Đăng xuất con khỏi mọi máy” để thử lại.");
        router.refresh();
      }
    } catch {
      setError("Mất kết nối mạng, thử lại sau.");
    } finally {
      setBusy(false);
    }
  }

  async function signOutAll() {
    if (!window.confirm(`Đăng xuất ${child.displayName} khỏi mọi máy? Máy nào cũng phải đăng nhập lại bằng mật khẩu (PIN chỉ dùng lại được sau khi đăng nhập bằng mật khẩu).`)) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    const err = await sendJson("POST", `/api/admin/children/${child.id}/sign-out`, {});
    setBusy(false);
    if (err) return setError(err);
    setNotice("Đã đăng xuất con khỏi mọi máy. Máy đang mở có thể còn dùng được tối đa 1 giờ.");
    router.refresh();
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

      <div className="flex flex-col gap-2 rounded-xl bg-bg p-3">
        <p className="text-sm">
          {remembered > 0 ? `Đang nhớ PIN trên ${remembered} trình duyệt.` : "Chưa trình duyệt nào nhớ PIN."} Lỡ đăng nhập trên máy lạ, hoặc nghi con cho người khác dùng?
        </p>
        <button type="button" disabled={busy} onClick={signOutAll} className="btn border border-ink/25 bg-white disabled:opacity-60">
          Đăng xuất con khỏi mọi máy
        </button>
      </div>

      <ByPinWipe childId={child.id} name={child.displayName} />

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm font-semibold text-accent">
          {notice}
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
