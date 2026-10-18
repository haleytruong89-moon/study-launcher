"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { parseBlockedUrl } from "../../extension/src/core/blockedUrl";

const noop = () => () => {};

/** The blocked address, only when it is a web page (the value is untrusted text). */
function blockedWebUrl(): string | null {
  const raw = parseBlockedUrl(window.location.href);
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

type Req = { state: "idle" } | { state: "sending" } | { state: "login" } | { state: "error"; text: string } | { state: "waiting" | "approved" | "denied"; id: string; status?: string };

const APPROVED: Record<string, string> = {
  approved_15m: "Bố mẹ đã mở trang này 15 phút.",
  approved_day: "Bố mẹ đã mở trang này đến hết hôm nay.",
  approved_permanent: "Bố mẹ đã thêm trang này vào danh sách trang học.",
};

export function BlockedView() {
  const url = useSyncExternalStore(noop, blockedWebUrl, () => null);
  const host = url ? new URL(url).hostname : null;
  const [reason, setReason] = useState("");
  const [req, setReq] = useState<Req>({ state: "idle" });

  // While waiting, check the answer every 10 seconds.
  const waitingId = req.state === "waiting" ? req.id : null;
  useEffect(() => {
    if (!waitingId) return;
    const t = window.setInterval(async () => {
      try {
        const r = await fetch(`/api/unlock-requests?id=${waitingId}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { status: string };
        if (d.status === "denied") setReq({ state: "denied", id: waitingId });
        else if (d.status !== "pending") setReq({ state: "approved", id: waitingId, status: d.status });
      } catch {
        /* try again next tick */
      }
    }, 10_000);
    return () => window.clearInterval(t);
  }, [waitingId]);

  async function ask() {
    if (!url) return;
    setReq({ state: "sending" });
    try {
      const r = await fetch("/api/unlock-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, reason: reason.trim() || undefined }) });
      if (r.status === 401) return setReq({ state: "login" });
      const d = (await r.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!r.ok || !d?.id) return setReq({ state: "error", text: d?.error ?? "Chưa gửi được, thử lại." });
      setReq({ state: "waiting", id: d.id });
    } catch {
      setReq({ state: "error", text: "Mất kết nối mạng, thử lại." });
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5 py-10">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-2xl text-white" aria-hidden>
        ⏳
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Đang giờ học</h1>
        <p className="text-base text-ink/80">
          {host ? (
            <>
              Trang <strong className="break-all">{host}</strong> mở lại khi con xong việc hôm nay (giờ nghỉ hoặc giờ tự do).
            </>
          ) : (
            "Trang này mở lại khi con xong việc hôm nay (giờ nghỉ hoặc giờ tự do)."
          )}
        </p>
      </div>

      {url && (
        <section aria-label="Xin mở trang" className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
          {(req.state === "idle" || req.state === "error" || req.state === "sending") && (
            <>
              <strong>Cần trang này để học?</strong>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Để làm gì (tùy chọn)
                <input
                  value={reason}
                  maxLength={200}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="vd: học online với cô Lan"
                  className="min-h-11 rounded-xl border border-ink/30 px-3 text-base font-normal"
                />
              </label>
              <button type="button" disabled={req.state === "sending"} onClick={() => void ask()} className="btn bg-accent text-white disabled:opacity-60">
                {req.state === "sending" ? "Đang gửi…" : "Xin bố mẹ mở trang này"}
              </button>
              {req.state === "error" && (
                <p role="alert" className="text-sm text-red-700">
                  {req.text}
                </p>
              )}
            </>
          )}
          {req.state === "login" && (
            <p className="text-sm">
              Con cần đăng nhập trước.{" "}
              <Link href="/login?next=/today" className="font-semibold text-accent underline">
                Đăng nhập
              </Link>
            </p>
          )}
          {req.state === "waiting" && (
            <p role="status" className="text-sm font-semibold">
              Đã gửi. Đang chờ bố mẹ trả lời… (trang tự cập nhật)
            </p>
          )}
          {req.state === "approved" && (
            <div role="status" className="flex flex-col gap-2 text-sm">
              <strong className="text-accent">{APPROVED[req.status ?? ""] ?? "Bố mẹ đã đồng ý."}</strong>
              <span>Đợi khoảng 30 giây cho máy cập nhật, rồi bấm:</span>
              <a href={url} className="btn bg-accent text-white">
                Mở lại trang
              </a>
            </div>
          )}
          {req.state === "denied" && (
            <p role="status" className="text-sm font-semibold">
              Bố mẹ chưa đồng ý mở trang này lúc này.
            </p>
          )}
        </section>
      )}

      <Link href="/today" className="btn border border-accent bg-white text-base text-accent">
        Về việc hôm nay
      </Link>
    </main>
  );
}
