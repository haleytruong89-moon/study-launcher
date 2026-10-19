"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { RememberedChild } from "@/lib/pin/device";
import { LoginForm } from "./login-form";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"] as const;

/**
 * Login on a remembered browser (parent decision 19/10/2026): the child taps their name and
 * types the 6-digit PIN (keyboard or the big keypad). Email + password stays one tap away.
 */
export function PinLogin({ kids, next }: { kids: RememberedChild[]; next: string | null }) {
  const router = useRouter();
  const withPin = kids.filter((k) => k.hasPin);
  const [chosen, setChosen] = useState<RememberedChild | null>(withPin.length === 1 ? (withPin[0] ?? null) : null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState(withPin.length === 0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (chosen) inputRef.current?.focus();
  }, [chosen]);

  async function submit(value: string) {
    if (!chosen || value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/pin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childId: chosen.id, pin: value }) });
      const d = (await r.json().catch(() => null)) as { error?: string } | null;
      if (!r.ok) {
        setError(d?.error ?? "Có lỗi, thử lại.");
        setPin("");
        setBusy(false);
        inputRef.current?.focus();
        return;
      }
      router.replace(next ?? "/today");
      router.refresh();
    } catch {
      setError("Mất kết nối mạng, thử lại.");
      setBusy(false);
    }
  }

  function type(v: string) {
    const clean = v.replace(/\D/g, "").slice(0, 6);
    setPin(clean);
    if (clean.length === 6) void submit(clean);
  }

  if (email) {
    return (
      <div className="flex flex-col gap-4">
        <LoginForm next={next} />
        {withPin.length > 0 && (
          <button type="button" onClick={() => setEmail(false)} className="min-h-11 text-sm font-semibold text-accent underline">
            Quay lại đăng nhập bằng PIN
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {!chosen ? (
        <section aria-label="Ai đang dùng máy?" className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">Ai đang dùng máy?</h2>
          {withPin.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setChosen(k)}
              className="flex min-h-16 items-center gap-3 rounded-2xl px-4 text-left text-lg font-extrabold text-white"
              style={{ background: k.color ?? "#2b5d4f" }}
            >
              <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-white/20 text-xl">
                {k.icon ?? k.name.trim().split(/\s+/).pop()?.[0]?.toUpperCase()}
              </span>
              {k.name}
            </button>
          ))}
        </section>
      ) : (
        <section aria-label={`PIN của ${chosen.name}`} className="flex flex-col items-center gap-4">
          <div className="flex w-full items-center justify-between">
            <h2 className="text-lg font-bold">Chào {chosen.name}</h2>
            {withPin.length > 1 && (
              <button type="button" onClick={() => (setChosen(null), setPin(""), setError(null))} className="min-h-11 px-2 text-sm font-semibold text-accent">
                Đổi người
              </button>
            )}
          </div>
          <label className="flex w-full flex-col items-center gap-2 text-sm font-semibold">
            Nhập PIN 6 số
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              disabled={busy}
              onChange={(e) => type(e.target.value)}
              className="min-h-14 w-full max-w-60 rounded-2xl border-2 border-ink/25 bg-white text-center text-3xl tracking-[0.5em]"
            />
          </label>
          <div className="grid w-full max-w-72 grid-cols-3 gap-2" aria-label="Bàn phím số">
            {KEYS.map((k, i) =>
              k === "" ? (
                <span key={i} />
              ) : (
                <button
                  key={k}
                  type="button"
                  disabled={busy}
                  aria-label={k === "⌫" ? "Xóa 1 số" : k}
                  onClick={() => type(k === "⌫" ? pin.slice(0, -1) : pin + k)}
                  className="min-h-14 rounded-2xl bg-white text-2xl font-bold shadow-[0_1px_0_rgba(28,31,29,.12)] disabled:opacity-50"
                >
                  {k}
                </button>
              ),
            )}
          </div>
          {busy && <p className="text-sm font-semibold">Đang đăng nhập…</p>}
          {error && (
            <p role="alert" className="text-center text-sm font-medium text-red-700">
              {error}
            </p>
          )}
        </section>
      )}
      <button type="button" onClick={() => setEmail(true)} className="min-h-11 text-sm font-semibold text-ink/75 underline">
        Đăng nhập bằng email (bố mẹ, hoặc quên PIN)
      </button>
    </div>
  );
}
