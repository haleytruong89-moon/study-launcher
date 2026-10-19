"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { sendJson } from "@/lib/api-client";
import { EXTEND_CHOICES, LOCK_CHOICES, OPEN_CHOICES, type OverrideAction } from "@/lib/admin/override";

type Mode = Exclude<OverrideAction, "clear">;

const duration = (m: number | null) => (m === null ? "đến hết hôm nay" : m >= 60 ? `${m / 60} giờ` : `${m} phút`);

const MODES: { mode: Mode; label: string; sub: string; choices: readonly (number | null)[] }[] = [
  { mode: "open", label: "Mở mọi trang", sub: "tra cứu, xem video học", choices: OPEN_CHOICES },
  { mode: "lock", label: "Khóa lại", sub: "chỉ trang học", choices: LOCK_CHOICES },
  { mode: "extend", label: "Cộng thêm", sub: "đang mở, thêm phút", choices: EXTEND_CHOICES },
];

function actionText(mode: Mode, minutes: number | null, name: string): string {
  if (mode === "open") return `Mở mọi trang ${duration(minutes)} cho ${name}`;
  if (mode === "lock") return `Khóa máy của ${name} ${duration(minutes)}`;
  return `Cộng thêm ${minutes} phút cho ${name}`;
}

/**
 * "Mở / khóa máy" as a bottom sheet (UI review 19/10/2026): choose what, then how long,
 * then ONE big button that says exactly what will happen (no browser confirm box).
 * Same API and rules as before (S3c): server clock, ends by 00:00, logged.
 */
export function OverrideSheet({
  childId,
  name,
  open,
  override,
  now,
  triggerClass,
  triggerStyle,
  triggerLabel = "Mở / khóa máy",
}: {
  childId: string;
  name: string;
  /** The laptop is open right now (offers "Cộng thêm"). */
  open: boolean;
  /** A parent open/lock is running (offers "Về bình thường"). */
  override: string | null;
  /** "Bây giờ: …" line. */
  now: string;
  triggerClass: string;
  triggerStyle?: React.CSSProperties;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>(open ? "lock" : "open");
  const [minutes, setMinutes] = useState<number | null>(30);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const modes = MODES.filter((m) => m.mode !== "extend" || open);
  const current = modes.find((m) => m.mode === mode) ?? modes[0]!;
  const valid = current.choices.includes(minutes);

  function pick(next: Mode) {
    setMode(next);
    const choices = MODES.find((m) => m.mode === next)!.choices;
    setMinutes(choices.includes(30) ? 30 : (choices[0] ?? null));
  }

  async function send(action: OverrideAction, mins: number | null, text: string) {
    setBusy(true);
    setError(null);
    const err = await sendJson("POST", "/api/admin/overrides", { childId, action, minutes: mins, reason: reason.trim() || null });
    setBusy(false);
    if (err) return setError(err);
    setReason("");
    setDone(`Đã gửi: ${text}. Máy của con đổi trong khoảng 1 phút.`);
    dialog.current?.close();
    router.refresh();
  }

  const titleId = `ov-${childId}`;
  return (
    <>
      <button
        type="button"
        className={triggerClass}
        style={triggerStyle}
        onClick={() => {
          setError(null);
          setDone(null);
          pick(open ? "lock" : "open");
          dialog.current?.showModal();
        }}
      >
        {triggerLabel}
      </button>
      {done && (
        <p role="status" className="col-span-full text-sm font-semibold">
          {done}
        </p>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="mx-auto mt-auto mb-0 w-full max-w-lg rounded-t-3xl bg-bg p-0 text-ink backdrop:bg-black/45"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="flex flex-col gap-4 px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div aria-hidden className="mx-auto h-1.5 w-10 rounded-full bg-ink/25" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={titleId} className="text-xl font-extrabold">
                Máy của {name}
              </h2>
              <p className="text-sm text-ink/75">Bây giờ: {now}</p>
            </div>
            <button type="button" aria-label="Đóng" onClick={() => dialog.current?.close()} className="size-11 shrink-0 rounded-xl bg-ink/10 text-lg">
              ✕
            </button>
          </div>

          <div role="radiogroup" aria-label="Muốn làm gì" className={`grid gap-2 ${modes.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {modes.map((m) => {
              const on = m.mode === mode;
              const tone = m.mode === "lock" ? "border-ink bg-ink text-white" : "border-[#7A400B] bg-[#FBE9D3] text-[#5E3108]";
              return (
                <button
                  key={m.mode}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pick(m.mode)}
                  className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border-2 px-1 text-center font-extrabold ${on ? tone : "border-ink/15 bg-white"}`}
                >
                  {m.label}
                  <span className="text-xs font-semibold opacity-80">{m.sub}</span>
                </button>
              );
            })}
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs font-extrabold tracking-wider text-ink/70 uppercase">Trong bao lâu</legend>
            {current.choices.map((m) => (
              <label key={String(m)} className={`flex min-h-13 items-center gap-3 rounded-2xl border-2 bg-white px-4 font-bold ${minutes === m ? "border-ink" : "border-ink/15"}`}>
                <input type="radio" name={`dur-${childId}`} checked={minutes === m} onChange={() => setMinutes(m)} className="size-5 accent-ink" />
                {mode === "extend" ? `+${m} phút` : duration(m).replace(/^đến/, "Đến")}
              </label>
            ))}
          </fieldset>

          <label className="flex flex-col gap-1.5 text-sm font-bold">
            Lý do (không bắt buộc, ghi vào nhật ký)
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              placeholder="Ví dụ: tra cứu bài KHTN"
              className="min-h-12 rounded-xl border border-ink/30 bg-white px-3 text-base font-normal"
            />
          </label>

          {error && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={busy || !valid}
            onClick={() => void send(mode, minutes, actionText(mode, minutes, name))}
            className={`min-h-14 rounded-2xl text-base font-extrabold text-white disabled:opacity-60 ${mode === "lock" ? "bg-ink" : "bg-[#7A400B]"}`}
          >
            {actionText(mode, minutes, name)}
          </button>
          {override && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void send("clear", null, `${name} về bình thường`)}
              className="min-h-12 rounded-2xl border-2 border-accent bg-white font-bold text-accent disabled:opacity-60"
            >
              Về bình thường <span className="font-semibold">({override})</span>
            </button>
          )}
          <p className="-mt-1 text-center text-xs text-ink/70">Máy con đổi trong khoảng 1 phút · mọi lệnh dừng muộn nhất lúc 00:00</p>
        </div>
      </dialog>
    </>
  );
}
