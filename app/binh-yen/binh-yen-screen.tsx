"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Voice } from "@/lib/binhYen/catalog";
import { HOTLINE_TEXT, byLockedMessage, pinWipedNotice } from "@/lib/binhYen/rules";
import { STUDY_CAP_TEXT } from "@/lib/binhYen/studyCap";
import { wipeVault } from "@/lib/binhYen/vault";
import { Corner } from "./corner";
import { TalkPanel, type TalkInfoView } from "./talk-panel";

/** What the server answers (lib/binhYen/session.ts ByState). */
interface ByStateView {
  enabled: boolean;
  hasPin: boolean;
  unlocked: boolean;
  lockedUntil: string | null;
  resetAt: string | null;
  idleMinutes: number;
  studyMinutes: number;
  /** R5: when this visit ends (study time only), and the server time of this answer. */
  study: { minutes: number; endsAt: string } | null;
  /** R5: the visit reached the study-time limit; the server ended the session. */
  capped: boolean;
  serverNow: string;
}

interface Child {
  id: string;
  name: string;
  color: string | null;
}

const PING_EVERY_MS = 30_000;
const PEEK_EVERY_MS = 30_000;
/** After the study-time limit: the message stays this long, then back to Hôm nay. */
const CAP_REDIRECT_MS = 3_000;

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
 * Góc bình yên for the child. Every decision is the server's: on/off, PIN, 5-try lock, idle
 * lock and the study-time limit (server clock). The screen's own timers only ask the server
 * EARLIER, never decide later. Nothing the child does here is logged; the only things sent are
 * the PIN and the keys of a finished visit, to our own server.
 */
export function BinhYenScreen({ child, voice, initial, initialTalk }: { child: Child; voice: Voice; initial: ByStateView | null; initialTalk: TalkInfoView | null }) {
  const router = useRouter();
  const [state, setState] = useState<ByStateView | null>(initial);
  /** The "Nhắn bố mẹ" activity shows the talk card inside the visit (never two cards). */
  const [talkInline, setTalkInline] = useState(false);
  const color = child.color ?? "#2b5d4f";
  const firstName = child.name.trim().split(/\s+/).pop() ?? child.name;

  const accept = useCallback((s: unknown) => {
    const v = s as ByStateView | null | undefined;
    if (v && typeof v.enabled === "boolean") setState(v);
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

  // R5: ask the server again right when this visit's study-time limit is due (server clock:
  // the delay is measured from the server's own "now", not the laptop's clock).
  const studyEndsAt = unlocked ? (state?.study?.endsAt ?? null) : null;
  const serverNow = state?.serverNow ?? null;
  useEffect(() => {
    if (!studyEndsAt || !serverNow) return;
    const ms = Math.max(0, Date.parse(studyEndsAt) - Date.parse(serverNow)) + 1000;
    const id = window.setTimeout(() => void refresh(), Math.min(ms, 2_147_000_000));
    return () => window.clearTimeout(id);
  }, [studyEndsAt, serverNow, refresh]);

  // At the limit: the message, then back to Hôm nay — unless the child is in "Nhắn bố mẹ"
  // ("Con muốn nói chuyện" is never limited, R5 / §4).
  const capped = !!state?.capped;
  useEffect(() => {
    if (!capped || talkInline) return;
    const id = window.setTimeout(() => router.replace("/today"), CAP_REDIRECT_MS);
    return () => window.clearTimeout(id);
  }, [capped, talkInline, router]);

  const showTalk = !talkInline || capped || !unlocked;
  const talkAvailable = !!initialTalk && (initialTalk.available || !!initialTalk.status);
  // "Cần bố mẹ?": the "Con muốn nói chuyện" card when a parent phone can be reached (or a
  // signal is pending); otherwise an honest "find them in person" + 111 / 115.
  const talkCard = (
    <section aria-label="Cần bố mẹ?" className="flex flex-col">
      {talkAvailable ? (
        <TalkPanel initial={initialTalk ?? undefined} color={color} />
      ) : (
        <div className="flex flex-col gap-1 rounded-2xl border border-ink/10 bg-white p-4 text-sm">
          <h2 className="text-lg font-bold">Cần bố mẹ?</h2>
          <p>Con tìm bố mẹ trực tiếp để nói chuyện nhé. Cần nói chuyện ngay với ai đó? Con có thể {HOTLINE_TEXT}. Nguy hiểm ngay: gọi 115.</p>
        </div>
      )}
    </section>
  );
  const talk = showTalk ? talkCard : null;

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
  } else if (state.capped) {
    content = (
      <div role="alert" className="flex flex-col gap-3 rounded-2xl bg-white p-5">
        <h2 className="text-xl font-bold">{STUDY_CAP_TEXT}</h2>
        <p className="text-sm text-ink/75">Trong giờ học, mỗi lần vào Góc bình yên tối đa {state.studyMinutes} phút. Vào lại lúc nào cũng được.</p>
        <Link href="/today" className="btn self-start text-white" style={{ background: color }}>
          Về Hôm nay
        </Link>
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
    content = (
      <Corner
        voice={voice}
        firstName={firstName}
        color={color}
        state={state}
        onState={accept}
        onLock={async () => {
          setTalkInline(false);
          accept((await call("POST", "/api/by/lock")).data);
        }}
        onTalkInline={setTalkInline}
        talk={talkCard}
      />
    );
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
