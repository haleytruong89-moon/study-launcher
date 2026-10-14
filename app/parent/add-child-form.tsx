"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CHILD_COLORS } from "@/lib/childColors";

const COLORS = CHILD_COLORS;

interface Created {
  email: string;
  password: string;
}

export function AddChildForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const res = await fetch("/api/admin/children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: String(form.get("displayName") ?? ""),
        grade: Number(form.get("grade")),
        color: String(form.get("color") ?? ""),
      }),
    });
    setBusy(false);
    const body = (await res.json().catch(() => null)) as
      | { error?: string; child?: { email: string; password: string } }
      | null;
    if (!res.ok || !body?.child) {
      setError(body?.error ?? "Có lỗi, thử lại sau.");
      return;
    }
    setCreated({ email: body.child.email, password: body.child.password });
    formEl.reset();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Tên hiển thị
          <input name="displayName" required maxLength={80} className="min-h-11 rounded-xl border border-ink/20 bg-white px-3 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Lớp
          <input name="grade" type="number" min={1} max={12} required className="min-h-11 rounded-xl border border-ink/20 bg-white px-3 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Màu
          <select name="color" className="min-h-11 rounded-xl border border-ink/20 bg-white px-3 text-base">
            {COLORS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn bg-accent text-white disabled:opacity-60">
          {busy ? "Đang tạo…" : "Tạo tài khoản"}
        </button>
      </form>

      {created && (
        <div role="status" className="rounded-xl border border-accent/40 bg-white p-4 text-sm">
          <p className="font-semibold">Đã tạo. Lưu thông tin đăng nhập này ngay — mật khẩu chỉ hiện một lần.</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-ink/60">Email</dt>
            <dd className="break-all font-mono">{created.email}</dd>
            <dt className="text-ink/60">Mật khẩu</dt>
            <dd className="break-all font-mono">{created.password}</dd>
          </dl>
          <p className="mt-2 text-ink/70">Dùng để đăng nhập một lần trên máy của con. Con không cần nhớ mật khẩu.</p>
        </div>
      )}
    </div>
  );
}
