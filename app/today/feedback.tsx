"use client";

import { useState } from "react";
import {
  FEEDBACK_KINDS,
  FEEDBACK_LABELS,
  FEEDBACK_MAX_CHARS,
  FEEDBACK_NOT_PRIVATE,
  FEEDBACK_SENT,
  type FeedbackKind,
} from "@/lib/feedback/rules";
import { Modal } from "./today-extras";

/**
 * "💡 Góp ý" (parent decision 07/11/2026): the child tells the parents what they like, do not
 * like, or an idea for the APP. NOT private — the sheet says so before sending; inside Góc bình
 * yên it also says that, unlike the corner, parents read this. One server route; no push.
 * `variant="header"`: the button in the coloured header of Hôm nay; `"corner"`: a small link at
 * the bottom of the Góc bình yên home.
 */
export function FeedbackButton({ color, variant }: { color: string; variant: "header" | "corner" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "header" ? (
        <button type="button" onClick={() => setOpen(true)} className="btn border border-white/50 bg-transparent text-sm text-white">
          💡 Góp ý
        </button>
      ) : (
        <div className="flex flex-col items-start gap-0.5 px-1">
          <button type="button" onClick={() => setOpen(true)} className="min-h-11 text-sm font-semibold text-ink/75 underline">
            Góp ý cho app
          </button>
          <span className="text-xs text-ink/60">Góp ý không riêng tư như góc này: bố mẹ sẽ đọc.</span>
        </div>
      )}
      {open && <FeedbackSheet color={color} inCorner={variant === "corner"} onClose={() => setOpen(false)} />}
    </>
  );
}

function FeedbackSheet({ color, inCorner, onClose }: { color: string; inCorner: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!kind || !body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, body }) });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.ok) {
        setSent(true);
        setKind(null);
        setBody("");
      } else setError(data?.error ?? "Chưa gửi được, thử lại sau.");
    } catch {
      setError("Mất kết nối mạng, thử lại sau.");
    }
    setBusy(false);
  }

  return (
    <Modal title="Góp ý cho app" error={error} onClose={onClose}>
      <p className="rounded-xl bg-[#FBF0D6] p-3 text-sm font-semibold text-[#5E3D00]">
        {FEEDBACK_NOT_PRIVATE}
        {inCorner && " Khác với Góc bình yên, góp ý không phải chuyện riêng: bố mẹ thấy tên con và điều con viết."}
      </p>
      {sent && (
        <p role="status" className="text-sm font-semibold" style={{ color }}>
          {FEEDBACK_SENT}
        </p>
      )}
      <form onSubmit={send} aria-label="Gửi góp ý" className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Con thấy thế nào?</legend>
          <div className="flex flex-wrap gap-2">
            {FEEDBACK_KINDS.map((k) => (
              <label
                key={k}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-full border-[1.5px] px-4 text-sm font-semibold has-[:focus-visible]:outline-2"
                style={kind === k ? { borderColor: color, background: `${color}1A` } : { borderColor: "rgb(28 31 29 / 0.2)" }}
              >
                <input type="radio" name="feedback-kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                {FEEDBACK_LABELS[k]}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Con muốn nói gì về app?
          <textarea
            value={body}
            maxLength={FEEDBACK_MAX_CHARS}
            rows={4}
            onChange={(e) => {
              setBody(e.target.value);
              setSent(false);
            }}
            className="rounded-xl border border-ink/30 bg-white p-3 text-base font-normal"
          />
          <span className="self-end text-xs font-normal text-ink/60">
            {body.length}/{FEEDBACK_MAX_CHARS}
          </span>
        </label>
        <button type="submit" disabled={busy || !kind || !body.trim()} className="btn self-start text-white disabled:opacity-50" style={{ background: color }}>
          {busy ? "Đang gửi…" : "Gửi"}
        </button>
      </form>
    </Modal>
  );
}
