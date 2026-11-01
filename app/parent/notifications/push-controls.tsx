"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "unsupported" | "needs-home-screen" | "denied" | "off" | "on";

function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Turn Web Push on / off for THIS device, and send a test (S5). */
export function PushControls({ publicKey, devices }: { publicKey: string; devices: number }) {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let next: Status;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        next = isIos() && !isStandalone() ? "needs-home-screen" : "unsupported";
      } else if (Notification.permission === "denied") {
        next = "denied";
      } else {
        next = (await currentSubscription().catch(() => null)) ? "on" : "off";
      }
      if (alive) setStatus(next);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      // Must run from the tap itself (iOS rule), before any other await.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) }));
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setMessage(data?.error ?? "Chưa lưu được, thử lại sau.");
        return;
      }
      setStatus("on");
      setMessage("Đã bật. Bấm “Gửi thử” để kiểm tra.");
    } catch {
      setMessage("Chưa bật được. Thử lại, hoặc mở trang này từ biểu tượng trên Màn hình chính.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setStatus("off");
      setMessage("Đã tắt thông báo trên máy này.");
    } catch {
      setMessage("Chưa tắt được, thử lại sau.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { sent?: number; error?: string } | null;
      if (!res.ok) setMessage(data?.error ?? "Có lỗi, thử lại sau.");
      else if (!data?.sent) setMessage("Chưa gửi được tới máy nào. Tắt rồi bật lại thông báo.");
      else setMessage(`Đã gửi tới ${data.sent} máy. Thông báo sẽ hiện trong vài giây.`);
    } catch {
      setMessage("Mất kết nối mạng, thử lại sau.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-white p-4" aria-labelledby="push-this-device">
      <h2 id="push-this-device" className="font-bold">
        Máy này
      </h2>
      {status === "checking" && <p className="text-sm text-ink/70">Đang kiểm tra…</p>}
      {status === "needs-home-screen" && (
        <div className="flex flex-col gap-2 text-sm">
          <p>Trên iPhone, thông báo chỉ chạy khi mở app từ Màn hình chính:</p>
          <ol className="list-decimal pl-5 text-ink/80">
            <li>
              Mở trang này bằng <b>Safari</b>, bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên lên).
            </li>
            <li>
              Chọn <b>Thêm vào MH chính</b> → <b>Thêm</b>.
            </li>
            <li>Mở app từ biểu tượng mới trên Màn hình chính, vào Thêm › Thông báo, bấm Bật.</li>
          </ol>
        </div>
      )}
      {status === "unsupported" && <p className="text-sm">Trình duyệt này không hỗ trợ thông báo. Trên iPhone cần iOS 16.4 trở lên.</p>}
      {status === "denied" && (
        <p className="text-sm">
          Máy đang <b>chặn</b> thông báo của app. Vào <b>Cài đặt › Thông báo › Study Launcher</b>, bật <b>Cho phép thông báo</b>, rồi mở lại trang này.
        </p>
      )}
      {status === "off" && (
        <button type="button" disabled={busy} onClick={() => void turnOn()} className="btn bg-accent text-white disabled:opacity-60">
          {busy ? "Đang bật…" : "Bật thông báo trên máy này"}
        </button>
      )}
      {status === "on" && (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex min-h-11 items-center rounded-full bg-[#E3ECE7] px-3 text-sm font-bold text-accent">✓ Đang bật</span>
          <button type="button" disabled={busy} onClick={() => void sendTest()} className="btn border border-accent bg-white text-accent disabled:opacity-60">
            Gửi thử
          </button>
          <button type="button" disabled={busy} onClick={() => void turnOff()} className="btn border border-ink/20 bg-white text-ink/80 disabled:opacity-60">
            Tắt
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      <p className="text-xs text-ink/60">Tài khoản này đang bật thông báo trên {devices} máy. Mỗi điện thoại cần bật riêng.</p>
    </section>
  );
}

/**
 * First-time setup: the VAPID keys and the cron secret are created HERE in the parent's
 * browser (Web Crypto) and pasted into Vercel / GitHub. They never pass through the server
 * or a chat.
 */
export function KeyHelper({ appUrl }: { appUrl: string }) {
  const [keys, setKeys] = useState<{ publicKey: string; privateKey: string; cronSecret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    try {
      const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
      const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
      if (!jwk.d) throw new Error("no private key");
      const secret = new Uint8Array(32);
      crypto.getRandomValues(secret);
      setKeys({ publicKey: bytesToBase64Url(raw), privateKey: jwk.d, cronSecret: bytesToBase64Url(secret) });
    } catch {
      setError("Trình duyệt này không tạo được khóa. Thử bằng Chrome hoặc Safari mới.");
    }
  }

  const rows: [string, string][] = keys
    ? [
        ["VAPID_PUBLIC_KEY", keys.publicKey],
        ["VAPID_PRIVATE_KEY", keys.privateKey],
        ["VAPID_SUBJECT", appUrl || "https://<link-vercel-của-bạn>"],
        ["CRON_SECRET", keys.cronSecret],
      ]
    : [];

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-white p-4" aria-labelledby="push-setup">
      <h2 id="push-setup" className="font-bold">
        Cài đặt lần đầu (làm 1 lần, trên máy tính)
      </h2>
      <p className="text-sm text-ink/80">
        Thông báo cần một bộ khóa riêng của gia đình. Bấm nút dưới để tạo ngay trong trình duyệt này, rồi dán vào Vercel theo{" "}
        <b>SETUP bước A10</b>. Khóa không gửi đi đâu cả.
      </p>
      {!keys && (
        <button type="button" onClick={() => void create()} className="btn self-start bg-accent text-white">
          Tạo khóa thông báo
        </button>
      )}
      {keys && (
        <>
          <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">
            Chỉ hiện 1 lần. Dán ngay vào Vercel. <b>Không gửi qua chat, Zalo, email.</b> Tải lại trang là mất, phải tạo bộ mới.
          </p>
          <dl className="flex flex-col gap-2">
            {rows.map(([name, value]) => (
              <div key={name} className="flex flex-col gap-1">
                <dt className="text-xs font-bold">{name}</dt>
                <dd className="flex gap-2">
                  <input readOnly value={value} aria-label={name} className="min-h-11 grow rounded-lg border border-ink/20 px-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                  <button type="button" className="btn border border-ink/20 bg-white text-sm" onClick={() => void navigator.clipboard?.writeText(value)}>
                    Chép
                  </button>
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-ink/80">
            <b>CRON_SECRET</b> dán ở <b>cả hai nơi</b>: Vercel (biến môi trường) và GitHub (Secrets, cùng chỗ bước A9), kèm secret <b>APP_URL</b> = link Vercel chính thức.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
