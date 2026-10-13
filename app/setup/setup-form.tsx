"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SetupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        familyName: String(form.get("familyName") ?? ""),
        displayName: String(form.get("displayName") ?? ""),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Có lỗi, thử lại sau.");
      return;
    }
    router.replace("/parent");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Tên gia đình
        <input name="familyName" required maxLength={80} className="min-h-11 rounded-xl border border-ink/20 bg-white px-3 text-base" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Tên hiển thị của bạn
        <input name="displayName" required maxLength={80} className="min-h-11 rounded-xl border border-ink/20 bg-white px-3 text-base" />
      </label>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn bg-accent text-white disabled:opacity-60">
        {busy ? "Đang tạo…" : "Tạo gia đình"}
      </button>
    </form>
  );
}
