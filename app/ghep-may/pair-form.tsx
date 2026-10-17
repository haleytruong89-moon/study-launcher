"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const PAGE = "study-launcher-page";
const EXT = "study-launcher-ext";

type Ext = "checking" | "missing" | "ready" | "paired";

/**
 * Talks to the extension through window.postMessage (its content script runs only on the
 * Launcher's own domain and relays to the extension). The token goes to the extension
 * only; the extension's server address is fixed when it is built, never taken from here.
 */
export function PairForm() {
  const [ext, setExt] = useState<Ext>("checking");
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("Laptop");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window || e.origin !== window.location.origin) return;
      const d = e.data as { source?: string; type?: string; paired?: boolean; ok?: boolean } | null;
      if (!d || d.source !== EXT) return;
      if (d.type === "pong") setExt(d.paired ? "paired" : "ready");
      if (d.type === "paired") {
        setBusy(false);
        if (d.ok) {
          setExt("paired");
          setMsg({ ok: true, text: "Xong! Máy này đã ghép. Từ giờ web theo giờ học của con." });
        } else setMsg({ ok: false, text: "Extension chưa nhận được, thử lại." });
      }
    };
    window.addEventListener("message", onMessage);
    window.postMessage({ source: PAGE, type: "ping" }, window.location.origin);
    const t = window.setTimeout(() => setExt((s) => (s === "checking" ? "missing" : s)), 1500);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(t);
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!/^\d{6}$/.test(code)) return setMsg({ ok: false, text: "Mã gồm 6 chữ số." });
    setBusy(true);
    try {
      const res = await fetch("/api/ext/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, label }) });
      const data = (await res.json().catch(() => null)) as { token?: string; error?: string } | null;
      if (!res.ok || !data?.token) {
        setBusy(false);
        return setMsg({ ok: false, text: data?.error ?? "Có lỗi, thử lại." });
      }
      window.postMessage({ source: PAGE, type: "pair", token: data.token }, window.location.origin);
      window.setTimeout(() => setBusy((b) => (b ? false : b)), 5000);
    } catch {
      setBusy(false);
      setMsg({ ok: false, text: "Mất kết nối mạng, thử lại." });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${ext === "missing" ? "bg-[#F7E4E0] text-[#8A2B1F]" : "bg-white text-ink"}`}>
        {ext === "checking" && "Đang tìm extension Study Launcher trên trình duyệt này…"}
        {ext === "missing" && "Chưa thấy extension Study Launcher trên trình duyệt này. Bố mẹ cài extension trước (trang phụ huynh → Thiết bị → hướng dẫn), rồi tải lại trang."}
        {ext === "ready" && "✓ Đã thấy extension. Nhập mã bố mẹ đưa."}
        {ext === "paired" && "✓ Máy này đã ghép với tài khoản của con."}
      </p>
      {ext !== "paired" && (
        <form onSubmit={submit} className="flex flex-col gap-3" aria-label="Ghép máy">
          <label className="flex flex-col gap-1 text-sm font-bold">
            Mã 6 số
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="min-h-14 rounded-xl border border-ink/30 bg-white px-3 text-center text-3xl font-bold tracking-[0.3em]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">
            Tên máy (để bố mẹ nhận ra)
            <input value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} className="min-h-11 rounded-xl border border-ink/30 bg-white px-3 text-base font-normal" />
          </label>
          <button type="submit" disabled={busy || ext !== "ready"} className="btn min-h-12 bg-accent text-base text-white disabled:opacity-50">
            {busy ? "Đang ghép…" : "Ghép máy"}
          </button>
        </form>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm font-semibold ${msg.ok ? "text-accent" : "text-red-700"}`}>
          {msg.text}
        </p>
      )}
      <Link href="/today" className="text-sm font-semibold text-accent underline">
        Về Hôm nay
      </Link>
    </div>
  );
}
