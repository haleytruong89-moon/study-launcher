"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { whoSeesWhat } from "@/lib/binhYen/copy";
import { byLockedMessage, pinWipedNotice } from "@/lib/binhYen/rules";
import { wipeVault } from "@/lib/binhYen/vault";
import { TalkPanel, type TalkInfoView } from "./talk-panel";

/** What the server answers (lib/binhYen/session.ts ByState). */
interface ByStateView {
  enabled: boolean;
  hasPin: boolean;
  unlocked: boolean;
  lockedUntil: string | null;
  resetAt: string | null;
  idleMinutes: number;
}

interface Child {
  id: string;
  name: string;
  color: string | null;
}

const PING_EVERY_MS = 30_000;
const PEEK_EVERY_MS = 30_000;

async function call(method: "GET" | "POST", url: string, body?: unknown): Promise<{ ok: boolean; data: (ByStateView & { error?: string; state?: ByStateView }) | null }> {
  try {
    const res = await fetch(url, {
      method,
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { ok: res.ok, data: (await res.json().catch(() => null)) as never };
  } catch {
    return { ok: false, data: { error: "Mất kết nối mạng, thử lại sau." } as never };
  }
}

/**
 * Góc bình yên for the child (S-BY0 skeleton). Every decision is the server's: on/off, PIN,
 * 5-try lock, idle lock (server clock). The screen's own idle timer only locks EARLIER, never later.
 * Nothing the child types here is logged or sent anywhere except the PIN to our own server.
 */
export function BinhYenScreen({ child, initial, initialTalk }: { child: Child; initial: ByStateView | null; initialTalk: TalkInfoView | null }) {
  const [state, setState] = useState<ByStateView | null>(initial);
  const color = child.color ?? "#2b5d4f";
  const firstName = child.name.trim().split(/\s+/).pop() ?? child.name;

  const accept = useCallback((s: ByStateView | null | undefined) => {
    if (s && typeof s.enabled === "boolean") setState(s);
  }, []);

  const refresh = useCallback(async () => {
    const { ok, data } = await call("GET", "/api/by/state");
    if (ok) accept(data);
  }, [accept]);

  useEffect(() => {
    if (initial) return;
    const id = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(id);
  }, [initial, refresh]);

  // A parent wiped the PIN: this browser deletes the private text it kept, once per wipe (Q1, R6).
  const resetAt = state?.resetAt ?? null;
  useEffect(() => {
    if (!resetAt) return;
    try {
      const marker = `by:v1:${child.id}:resetSeen`;
      if (window.localStorage.getItem(marker) !== resetAt) {
        wipeVault(window.localStorage, child.id);
        window.localStorage.setItem(marker, resetAt);
      }
    } catch {
      /* storage blocked: there is nothing stored either */
    }
  }, [resetAt, child.id]);

  // While open: touches keep the server session alive; idle → lock. Peeks never extend it.
  const unlocked = !!state?.unlocked;
  const idleMinutes = state?.idleMinutes ?? 5;
  const lastActivity = useRef(0);
  useEffect(() => {
    if (!unlocked) return;
    lastActivity.current = Date.now();
    let lastPing = Date.now();
    const onActivity = () => {
      lastActivity.current = Date.now();
      if (Date.now() - lastPing > PING_EVERY_MS) {
        lastPing = Date.now();
        void call("POST", "/api/by/ping").then(({ ok, data }) => ok && accept(data));
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = window.setInterval(() => {
      if (Date.now() - lastActivity.current > idleMinutes * 60_000) void call("POST", "/api/by/lock").then(({ data }) => accept(data));
      else if (document.visibilityState === "visible") void refresh();
    }, PEEK_EVERY_MS);
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      for (const e of events) window.removeEventListener(e, onActivity);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [unlocked, idleMinutes, accept, refresh]);

  const talk = <TalkPanel initial={initialTalk ?? undefined} color={color} />;

  let content: React.ReactNode;
  if (!state) {
    content = (
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-5">
        <p role="alert">Chưa tải được Góc bình yên. Thử lại sau ít phút.</p>
        <button type="button" onClick={() => void refresh()} className="btn text-white" style={{ background: color }}>
          Thử lại
        </button>
      </div>
    );
  } else if (!state.enabled) {
    content = (
      <div className="flex flex-col gap-2 rounded-2xl bg-white p-5">
        <h2 className="text-xl font-bold">Góc bình yên chưa mở.</h2>
        <p className="text-ink/75">Bố mẹ sẽ bật cùng con.</p>
      </div>
    );
  } else if (state.lockedUntil) {
    content = (
      <div className="flex flex-col gap-2 rounded-2xl bg-white p-5">
        <h2 className="text-xl font-bold">Đang khóa</h2>
        <p role="alert">{byLockedMessage(state.lockedUntil)}</p>
        <p className="text-sm text-ink/70">Quên PIN? Bố mẹ chỉ có thể xóa PIN này (chữ con viết trên máy sẽ bị xóa theo).</p>
      </div>
    );
  } else if (!state.hasPin) {
    content = <SetPin color={color} resetAt={state.resetAt} onDone={accept} />;
  } else if (!state.unlocked) {
    content = <EnterPin color={color} onDone={accept} />;
  } else {
    content = <Home firstName={firstName} color={color} idleMinutes={state.idleMinutes} onLock={async () => accept((await call("POST", "/api/by/lock")).data)} />;
  }

  return (
    <div className="min-h-dvh bg-bg">
      <header className="text-white" style={{ background: color }}>
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 pt-5 pb-4">
          <Link href="/today" className="-ml-1 inline-flex min-h-11 items-center px-1 text-sm font-bold">
            ‹ Hôm nay
          </Link>
          <h1 className="ml-auto text-xl font-bold">🌿 Góc bình yên</h1>
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-5 px-4 py-5">
        {content}
        {talk}
      </main>
    </div>
  );
}

function PinField({ label, value, onChange, autoFocus }: { label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        pattern="\d{6}"
        maxLength={6}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="min-h-12 rounded-xl border border-ink/30 bg-white px-3 text-center text-2xl tracking-[0.5em]"
      />
    </label>
  );
}

function SetPin({ color, resetAt, onDone }: { color: string; resetAt: string | null; onDone: (s: ByStateView | null) => void }) {
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, data } = await call("POST", "/api/by/pin/set", { pin, again });
    setBusy(false);
    setPin("");
    setAgain("");
    if (ok) onDone(data);
    else setError(data?.error ?? "Có lỗi, thử lại sau.");
  }
  return (
    <form onSubmit={submit} aria-label="Đặt PIN Góc bình yên" className="flex flex-col gap-4 rounded-2xl bg-white p-5">
      {resetAt && (
        <p role="status" className="rounded-xl bg-[#FBF0D6] p-3 text-sm font-semibold text-[#5E3D00]">
          {pinWipedNotice(resetAt)}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold">Đặt PIN của riêng con</h2>
        <p className="text-sm text-ink/75">
          6 số chỉ con biết, khác PIN đăng nhập. Bố mẹ không xem được PIN này. Nếu con quên, bố mẹ chỉ có thể xóa nó — khi đó chữ con viết trên máy cũng bị xóa.
        </p>
      </div>
      <PinField label="PIN mới (6 số)" value={pin} onChange={setPin} autoFocus />
      <PinField label="Gõ lại PIN" value={again} onChange={setAgain} />
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || pin.length !== 6 || again.length !== 6} className="btn text-white disabled:opacity-60" style={{ background: color }}>
        {busy ? "Đang lưu…" : "Đặt PIN"}
      </button>
    </form>
  );
}

function EnterPin({ color, onDone }: { color: string; onDone: (s: ByStateView | null) => void }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, data } = await call("POST", "/api/by/pin/verify", { pin });
    setBusy(false);
    setPin("");
    if (ok) return onDone(data);
    setError(data?.error ?? "Có lỗi, thử lại sau.");
    if (data?.state) onDone(data.state);
  }
  return (
    <form onSubmit={submit} aria-label="Mở Góc bình yên" className="flex flex-col gap-4 rounded-2xl bg-white p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold">Gõ PIN Góc bình yên</h2>
        <p className="text-sm text-ink/75">PIN con tự đặt (không phải PIN đăng nhập).</p>
      </div>
      <PinField label="PIN Góc bình yên" value={pin} onChange={setPin} autoFocus />
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || pin.length !== 6} className="btn text-white disabled:opacity-60" style={{ background: color }}>
        {busy ? "Đang mở…" : "Mở"}
      </button>
    </form>
  );
}

function Home({ firstName, color, idleMinutes, onLock }: { firstName: string; color: string; idleMinutes: number; onLock: () => Promise<void> }) {
  return (
    <section aria-label="Góc của con" className="flex flex-col gap-4 rounded-2xl bg-white p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold">Chào {firstName} 🌿</h2>
        <p className="text-ink/75">Đây là góc riêng của con. Ở đây không có bài, không có điểm.</p>
      </div>
      <details className="rounded-xl bg-bg p-3">
        <summary className="min-h-11 cursor-pointer content-center font-bold">🔒 Ai thấy gì?</summary>
        <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-sm">
          {whoSeesWhat(idleMinutes).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
      <p className="rounded-xl border border-dashed p-3 text-sm" style={{ borderColor: color }}>
        Sắp có: chọn cảm xúc của con, vài cách làm dịu, và (nếu con muốn) hiểu vì sao.
      </p>
      <button type="button" onClick={() => void onLock()} className="btn self-start border border-ink/25 bg-white">
        Khóa lại
      </button>
    </section>
  );
}
