"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Avatar, Expression } from "@/lib/avatar";
import { hasPics, type AvatarPics } from "@/lib/avatarPics";
import { sendJson } from "@/lib/api-client";
import { Character } from "../avatar-face";

const FACES: { expr: Expression; label: string }[] = [
  { expr: "calm", label: "bình yên" },
  { expr: "smile", label: "vui" },
  { expr: "sad", label: "buồn" },
  { expr: "angry", label: "bực" },
];

/**
 * R3b: the parent sees the child's character (made in the app, or Picrew pictures) and can
 * take the pictures off — the app cannot tell a drawing from a photo (BINH_YEN_BIEU_TUONG.md §B).
 */
export function ChildAvatar({ childId, name, look, mine, pics }: { childId: string; name: string; look: Avatar; mine: boolean; pics: AvatarPics }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const withPics = hasPics(pics);

  async function removeAll() {
    if (!window.confirm(`Gỡ hết ảnh nhân vật của ${name}? Con sẽ quay về nhân vật tự tạo trong app.`)) return;
    setBusy(true);
    setError(null);
    const err = await sendJson("POST", `/api/admin/children/${childId}/avatar-pics`, {});
    setBusy(false);
    if (err) return setError(err);
    router.refresh();
  }

  return (
    <section aria-label={`Nhân vật của ${name}`} className="flex flex-col gap-2 border-t border-ink/10 py-3">
      <h3 className="font-semibold">Nhân vật của con</h3>
      <div className="flex gap-2">
        {FACES.map((f) => (
          <figure key={f.expr} className="flex w-16 flex-col items-center gap-0.5">
            <Character look={look} pics={pics} expr={f.expr} className="size-14" />
            <figcaption className="text-[11px] text-ink/60">{f.label}</figcaption>
          </figure>
        ))}
      </div>
      <p className="text-sm text-ink/70">
        {withPics ? "Con đang dùng ảnh tải lên (Picrew). Nếu là ảnh chụp, không phải hình vẽ, bố mẹ gỡ ở đây." : mine ? "Con tự tạo trong app (chỉ lưu lựa chọn, không có ảnh)." : "Con chưa tạo — đang là hình tạm."}
      </p>
      {withPics && (
        <button type="button" disabled={busy} onClick={() => void removeAll()} className="btn self-start border border-red-700/40 bg-[#F6DED8] text-sm disabled:opacity-50">
          Gỡ ảnh nhân vật của con
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
