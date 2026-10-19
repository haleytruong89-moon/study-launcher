"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { TaskView } from "@/lib/dayState";

interface Picked {
  key: string;
  file: File;
  url: string;
}

const noop = () => () => {};
/** A mouse / trackpad laptop: show the "chụp bằng điện thoại" QR first. */
const isLaptop = () => window.matchMedia("(pointer: fine)").matches && !/iPhone|iPad|Android/i.test(navigator.userAgent);

/**
 * "Nộp ảnh bài" (child UI review 19/10/2026): pick one or more photos, look at them,
 * remove a blurry one, then ONE button sends them and finishes the homework.
 * On a laptop a QR code opens the same homework on the child's phone (already signed in);
 * the laptop picks up the result by itself.
 */
export function ProofSheet({
  item,
  color,
  max,
  sending,
  error,
  onSend,
  onClose,
}: {
  item: TaskView;
  color: string;
  /** Photos this homework can still take. */
  max: number;
  /** "Đang gửi ảnh 1/2…" while uploading, else null. */
  sending: string | null;
  error: string | null;
  onSend: (files: File[]) => Promise<boolean>;
  onClose: () => void;
}) {
  const laptop = useSyncExternalStore(noop, isLaptop, () => false);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [qr, setQr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const pickedRef = useRef<Picked[]>([]);
  useEffect(() => {
    pickedRef.current = picked;
  }, [picked]);
  useEffect(() => closeRef.current?.focus(), []);
  useEffect(() => () => pickedRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  useEffect(() => {
    if (!laptop) return;
    const link = `${window.location.origin}/today?nop=${item.id}`;
    QRCode.toString(link, { type: "svg", margin: 1, width: 200, color: { dark: "#1c1f1d", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [laptop, item.id]);

  function add(list: FileList | null) {
    if (!list) return;
    const room = max - picked.length;
    const images = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setNote(images.length > room ? `Tối đa ${max} ảnh cho bài này.` : images.length < list.length ? "Chỉ nhận ảnh." : null);
    setPicked((p) => [...p, ...images.slice(0, Math.max(0, room)).map((file) => ({ key: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))]);
  }

  function remove(key: string) {
    setPicked((p) => {
      const x = p.find((i) => i.key === key);
      if (x) URL.revokeObjectURL(x.url);
      return p.filter((i) => i.key !== key);
    });
  }

  const busy = sending !== null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/45 sm:items-center" onClick={busy ? undefined : onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Nộp ảnh bài ${item.title}`}
        className="flex max-h-[94dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-3xl bg-white p-5 text-ink sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onClose();
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold">Nộp ảnh bài {item.title}</h2>
            <span className="text-sm text-ink/70">Chụp rõ cả trang. Nhiều trang thì chụp nhiều ảnh.</span>
          </div>
          <button ref={closeRef} type="button" disabled={busy} onClick={onClose} aria-label="Đóng" className="flex size-11 shrink-0 items-center justify-center rounded-full text-xl font-bold hover:bg-bg disabled:opacity-40">
            ×
          </button>
        </div>

        {laptop && (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-bg p-4 text-center" aria-label="Chụp bằng điện thoại">
            <strong className="text-base">Chụp bằng điện thoại</strong>
            {qr ? (
              // The SVG is generated locally from our own link (no outside service).
              <div className="size-[200px] [&>svg]:size-full" role="img" aria-label="Mã QR mở bài này trên điện thoại" dangerouslySetInnerHTML={{ __html: qr }} />
            ) : (
              <div className="size-[200px] rounded-xl bg-white" />
            )}
            <span className="text-sm text-ink/75">Mở camera điện thoại, quét mã → chụp ảnh → bấm Nộp. Màn này tự cập nhật khi xong.</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {laptop && <span className="text-sm font-semibold text-ink/70">Hoặc chọn ảnh có sẵn trên máy này:</span>}
          <div className="grid grid-cols-3 gap-2">
            {picked.map((p, n) => (
              <div key={p.key} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-ink/10">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                <img src={p.url} alt={`Ảnh ${n + 1}`} className="size-full object-cover" />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(p.key)}
                  aria-label={`Bỏ ảnh ${n + 1}`}
                  className="absolute top-1 right-1 flex size-11 items-center justify-center rounded-full bg-white/90 text-lg font-bold"
                >
                  ×
                </button>
              </div>
            ))}
            {picked.length < max && (
              <label
                className={`flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-2 text-center text-sm font-bold ${busy ? "pointer-events-none opacity-50" : ""}`}
                style={{ borderColor: color, color }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
                {picked.length === 0 ? (laptop ? "Chọn ảnh" : "Chụp ảnh") : "Thêm ảnh"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    add(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
          {note && <span className="text-sm text-ink/70">{note}</span>}
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={busy || picked.length === 0}
          onClick={async () => {
            if (await onSend(picked.map((p) => p.file))) onClose();
          }}
          className="min-h-14 rounded-2xl text-[17px] font-bold text-white disabled:opacity-50"
          style={{ background: color }}
        >
          {sending ?? (picked.length === 0 ? "Chọn ít nhất 1 ảnh" : `Nộp ${picked.length} ảnh và xong`)}
        </button>
      </section>
    </div>
  );
}
