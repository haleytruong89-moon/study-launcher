"use client";

import { useState } from "react";
import { MAX_PIC_BYTES, MAX_PIC_EDGE, PIC_SLOTS, PIC_SLOT_LABELS, hasPics, picUrl, type AvatarPics } from "@/lib/avatarPics";
import type { Expression } from "@/lib/avatar";
import { shrinkPicture } from "@/lib/images";

/**
 * R3b (docs/BINH_YEN_BIEU_TUONG.md §B "Bản 2"): the child brings a character drawn on Picrew,
 * one picture per face. The browser redraws and shrinks it (nothing but the pixels is sent);
 * the server checks it again. A face without a picture uses the first one.
 */
export function PicrewPictures({ pics, onChange, color }: { pics: AvatarPics; onChange: (p: AvatarPics) => void; color: string }) {
  const [busy, setBusy] = useState<Expression | "all" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const first = PIC_SLOTS.find((s) => pics[s]);

  async function answer(res: Response, okText: string) {
    const data = (await res.json().catch(() => null)) as { error?: string; pics?: AvatarPics } | null;
    if (!res.ok || !data?.pics) {
      setMsg({ ok: false, text: data?.error ?? "Chưa được, thử lại sau." });
      return;
    }
    onChange(data.pics);
    setMsg({ ok: true, text: okText });
  }

  async function upload(slot: Expression, file: File | undefined) {
    if (!file) return;
    setMsg(null);
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      setMsg({ ok: false, text: "Chỉ nhận ảnh PNG hoặc JPG (ảnh tải về từ Picrew)." });
      return;
    }
    setBusy(slot);
    try {
      const small = await shrinkPicture(file, MAX_PIC_EDGE, MAX_PIC_BYTES);
      if (small.size > MAX_PIC_BYTES) {
        setMsg({ ok: false, text: "Ảnh lớn quá (tối đa 1 MB)." });
        return;
      }
      const form = new FormData();
      form.set("slot", slot);
      form.set("file", small, small.type === "image/png" ? "nhan-vat.png" : "nhan-vat.jpg");
      await answer(await fetch("/api/profile/avatar/pics", { method: "POST", body: form, cache: "no-store" }), `Đã thêm ảnh ${PIC_SLOT_LABELS[slot].toLowerCase()}.`);
    } catch {
      setMsg({ ok: false, text: "Không đọc được ảnh này. Thử ảnh khác nhé." });
    } finally {
      setBusy(null);
    }
  }

  async function remove(body: { slot: Expression } | { all: true }) {
    setMsg(null);
    setBusy("all" in body ? "all" : body.slot);
    try {
      await answer(
        await fetch("/api/profile/avatar/pics/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" }),
        "all" in body ? "Đã gỡ hết ảnh. Nhân vật con tự tạo quay lại." : "Đã gỡ ảnh.",
      );
    } catch {
      setMsg({ ok: false, text: "Chưa được, thử lại sau." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-label="Ảnh từ Picrew" className="flex flex-col gap-4 rounded-2xl bg-white p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold">Hoặc dùng nhân vật con vẽ trên Picrew</h2>
        <p className="text-sm text-ink/75">
          Tạo nhân vật trên Picrew, tải ảnh về máy, rồi chọn ở đây. Mỗi nét mặt một ảnh; ô nào chưa có ảnh thì dùng ảnh đầu tiên.
        </p>
        <p className="rounded-xl bg-[#FFF4E0] p-3 text-sm">
          <b>Chỉ hình vẽ, không dùng ảnh chụp con.</b> Cả nhà thấy ảnh này, bố mẹ gỡ được. Ảnh Picrew chỉ dùng trong app của nhà mình.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {PIC_SLOTS.map((slot) => {
          const pic = pics[slot];
          const label = PIC_SLOT_LABELS[slot];
          return (
            <li key={slot} className="flex items-center gap-3">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-bg text-center text-[11px] text-ink/60">
                {pic ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={picUrl(pic)} alt={`Ảnh ${label.toLowerCase()}`} className="size-full object-contain" />
                ) : first ? (
                  "dùng ảnh đầu"
                ) : (
                  "chưa có"
                )}
              </div>
              <span className="grow font-semibold">{label}</span>
              <label
                className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border-[1.5px] px-3 text-sm font-semibold has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2"
                style={{ borderColor: color, color }}
              >
                {busy === slot ? "Đang gửi…" : pic ? "Đổi ảnh" : "Chọn ảnh"}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  aria-label={`${pic ? "Đổi" : "Chọn"} ảnh ${label.toLowerCase()}`}
                  className="sr-only"
                  disabled={busy !== null}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    void upload(slot, f);
                  }}
                />
              </label>
              {pic && (
                <button type="button" disabled={busy !== null} onClick={() => void remove({ slot })} aria-label={`Gỡ ảnh ${label.toLowerCase()}`} className="min-h-11 px-2 text-sm font-semibold text-ink/70 underline disabled:opacity-50">
                  Gỡ
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm font-semibold text-[#2B5D4F]" : "text-sm text-red-700"}>
          {msg.text}
        </p>
      )}
      {hasPics(pics) && (
        <button type="button" disabled={busy !== null} onClick={() => void remove({ all: true })} className="btn self-start border border-ink/20 bg-white disabled:opacity-50">
          Gỡ hết ảnh, dùng nhân vật tự tạo
        </button>
      )}
    </section>
  );
}
