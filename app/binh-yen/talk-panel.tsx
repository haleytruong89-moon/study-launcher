"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { HOTLINE_TEXT, NOT_DELIVERED_TEXT, OFFLINE_TEXT, type TalkStatus } from "@/lib/binhYen/rules";

/** What GET/POST /api/by/signal answer (lib/binhYen/talk.ts TalkInfo). */
export interface TalkInfoView {
  available: boolean;
  parents: { id: string; name: string }[];
  status: TalkStatus | null;
  pollMs: number;
  corner: boolean;
}

const RETRIES = 2;
const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/**
 * "Con muốn nói chuyện" (BINH_YEN.md §4, §6). Shown on Hôm nay and inside Góc bình yên, never
 * behind the Góc bình yên PIN. Hidden when no parent phone has notifications on, so the child
 * is never told "đã báo" when nothing can arrive. `variant="header"`: a small button in the
 * coloured header of Hôm nay that opens the same panel.
 */
export function TalkPanel({ initial, color, variant = "card" }: { initial?: TalkInfoView | null; color: string; variant?: "card" | "header" }) {
  const [info, setInfo] = useState<TalkInfoView | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pickOne, setPickOne] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/by/signal", { cache: "no-store" });
      if (res.ok) setInfo((await res.json()) as TalkInfoView);
    } catch {
      /* keep what we have */
    }
  }, []);

  useEffect(() => {
    if (initial !== undefined) return;
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [initial, load]);

  // While a signal waits to be seen: re-read every 20 s (visible tab only) and on return.
  const waiting = !!info?.status && info.status.phase !== "seen";
  useEffect(() => {
    if (!waiting) return;
    const tick = () => {
      if (document.visibilityState === "visible") void load();
    };
    const id = window.setInterval(tick, info?.pollMs ?? 20_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [waiting, info?.pollMs, load]);

  async function send(to: string | null) {
    setBusy(true);
    setNote(null);
    // R3: a signal must not fail silently. Retry a lost connection, then tell the child.
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      try {
        const res = await fetch("/api/by/signal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "want_talk", to }) });
        const data = (await res.json().catch(() => null)) as (TalkInfoView & { error?: string; delivered?: boolean | null; repeated?: boolean }) | null;
        if (!res.ok || !data) {
          setNote(data?.error ?? OFFLINE_TEXT);
          if (res.status === 409) void load();
        } else {
          setInfo(data);
          setPickOne(false);
          if (data.delivered === false) setNote(NOT_DELIVERED_TEXT);
          else if (data.repeated) setNote("Con vừa gửi rồi. Bố mẹ sẽ thấy, đợi một chút nhé.");
        }
        setBusy(false);
        return;
      } catch {
        if (attempt < RETRIES) await wait(3000);
      }
    }
    setNote(OFFLINE_TEXT);
    setBusy(false);
  }

  const cornerLink =
    variant === "header" && info?.corner ? (
      <Link href="/binh-yen" className="btn border border-white/50 bg-transparent text-sm text-white">
        🌿 Góc bình yên
      </Link>
    ) : null;
  if (!info || (!info.available && !info.status)) return cornerLink;

  const both = info.parents.length !== 1;
  const sentTo = both ? "cả bố và mẹ" : (info.parents[0]?.name ?? "bố mẹ");
  const body = (
    <section aria-label="Con muốn nói chuyện" className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4 text-ink">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold">Con muốn nói chuyện với bố mẹ?</h2>
        <p className="text-sm text-ink/75">Bố mẹ chỉ nhận được: tên con và giờ con bấm. Không kèm gì khác.</p>
      </div>
      {info.available && (
        <>
          <button type="button" disabled={busy} onClick={() => void send(null)} className="btn text-white disabled:opacity-60" style={{ background: color }}>
            💬 Con muốn nói chuyện
          </button>
          <span className="text-xs text-ink/65">Gửi cho {sentTo}.</span>
          {info.parents.length >= 2 &&
            (pickOne ? (
              <div role="group" aria-label="Chỉ gửi cho một người" className="flex flex-wrap gap-2">
                {info.parents.map((p) => (
                  <button key={p.id} type="button" disabled={busy} onClick={() => void send(p.id)} className="btn border-[1.5px] bg-white disabled:opacity-60" style={{ borderColor: color, color }}>
                    Chỉ gửi cho {p.name}
                  </button>
                ))}
              </div>
            ) : (
              <button type="button" onClick={() => setPickOne(true)} className="min-h-11 self-start text-sm font-semibold underline" style={{ color }}>
                Chỉ gửi cho một người…
              </button>
            ))}
        </>
      )}
      {(info.status || note) && (
        <div role="status" className="flex flex-col gap-1 rounded-xl bg-bg p-3 text-sm font-semibold">
          {info.status && <span>{info.status.text}</span>}
          {note && <span className="text-[#8A3B12]">{note}</span>}
        </div>
      )}
      <p className="text-xs text-ink/65">Cần nói chuyện ngay với ai đó? Con có thể {HOTLINE_TEXT}. Nguy hiểm ngay: gọi 115.</p>
    </section>
  );

  if (variant === "card") return body;
  return (
    <>
      {cornerLink}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="btn border border-white/50 bg-transparent text-sm text-white"
      >
        {info.status && info.status.phase !== "seen" ? "💬 Đã gửi bố mẹ" : "💬 Muốn nói chuyện"}
      </button>
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col gap-2 rounded-2xl shadow-[0_8px_30px_rgba(28,31,29,0.25)]">
            {body}
          </div>
          <button type="button" onClick={() => setOpen(false)} className="btn mt-2 w-full border border-ink/20 bg-white text-ink">
            Đóng
          </button>
        </div>
      )}
    </>
  );
}
