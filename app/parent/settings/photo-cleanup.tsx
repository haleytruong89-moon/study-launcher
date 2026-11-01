"use client";

import { useState } from "react";
import { NETWORK_ERROR } from "@/lib/api-client";

interface Preview {
  retentionDays: number | null;
  cutoff: string | null;
  proofs: number;
  homework: number;
  bytes: number;
  more: boolean;
  max?: number;
}

const dmy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const mb = (bytes: number) => (bytes < 100 * 1024 ? "dưới 0,1 MB" : `khoảng ${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

/**
 * S3e: explains the weekly photo cleanup and lets the parent see what it WOULD delete now.
 * The preview never deletes anything.
 */
export function PhotoCleanup({ retentionDays }: { retentionDays: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  async function check() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/photo-cleanup");
      const data = (await res.json().catch(() => null)) as (Preview & { error?: string }) | null;
      if (!res.ok || !data) setError(data?.error ?? "Có lỗi, thử lại sau.");
      else setPreview(data);
    } catch {
      setError(NETWORK_ERROR);
    }
    setBusy(false);
  }

  const total = preview ? preview.proofs + preview.homework : 0;
  return (
    <section aria-labelledby="photo-cleanup-title" className="flex flex-col gap-3 rounded-2xl bg-white p-4">
      <h2 id="photo-cleanup-title" className="text-xs font-extrabold tracking-wider text-ink/70 uppercase">
        Tự xóa ảnh cũ
      </h2>
      <p className="text-sm">
        Mỗi tuần (rạng sáng thứ Hai) app tự xóa <strong>ảnh bài con nộp</strong> và <strong>tệp đề bài đã xong hoặc đã gỡ</strong> cũ hơn{" "}
        <strong>{retentionDays} ngày</strong> để kho ảnh không bị đầy. Chỉ xóa tệp: bài tập, giờ học và Đạt/Chưa đạt vẫn giữ nguyên. Ảnh đã xóa{" "}
        <strong>không lấy lại được</strong> (bản sao lưu không gồm ảnh).
      </p>
      <p className="text-xs text-ink/65">Đổi số ngày ở ô “Giữ ảnh bài” phía trên rồi bấm Lưu. Việc tự xóa chỉ bắt đầu sau khi đã cài khóa hẹn giờ CRON_SECRET (SETUP phần F).</p>
      <button type="button" onClick={check} disabled={busy} className="btn border border-accent/60 bg-white text-accent disabled:opacity-60">
        {busy ? "Đang kiểm tra…" : "Xem trước sẽ xóa gì"}
      </button>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {preview && (
        <div role="region" aria-live="polite" aria-label="Kết quả xem trước" className="flex flex-col gap-1 rounded-xl bg-ink/5 p-3 text-sm">
          {preview.retentionDays === null || !preview.cutoff ? (
            <span>Chưa đọc được số ngày giữ ảnh, nên app sẽ không xóa gì.</span>
          ) : total === 0 ? (
            <span>Chưa có tệp nào cũ hơn {preview.retentionDays} ngày (trước ngày {dmy(preview.cutoff)}). Lần chạy tới sẽ không xóa gì.</span>
          ) : (
            <>
              <span className="font-bold">
                Nếu chạy bây giờ sẽ xóa {preview.proofs} ảnh bài con nộp và {preview.homework} tệp đề bài ({mb(preview.bytes)}).
              </span>
              <span>Tất cả từ trước ngày {dmy(preview.cutoff)}.</span>
              {preview.more && <span>Còn nhiều hơn nữa: mỗi lần chỉ xóa tối đa {preview.max ?? 500} tệp, phần còn lại xóa ở các tuần sau.</span>}
            </>
          )}
          <span className="text-xs text-ink/60">Xem trước không xóa gì.</span>
        </div>
      )}
    </section>
  );
}
