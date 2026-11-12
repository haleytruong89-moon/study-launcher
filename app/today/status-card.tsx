"use client";

import type { DayState } from "@/lib/dayState";
import { clock, lockSoonText, type Banner } from "@/lib/today/view";
import type { Act } from "./today-parts";

/** Shared by Hôm nay and Góc học tập (R2): the status line with the lock-soon line and the countdown. */
export function StatusTop({ banner, soonMinutes, countdownTo, nowMs, color }: { banner: Banner; soonMinutes: number | null; countdownTo: string | null; nowMs: number; color: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex min-w-0 grow basis-60 flex-col gap-0.5">
        <strong className="text-lg">{banner.title}</strong>
        <span className="text-sm text-ink/75">{banner.sub}</span>
        {soonMinutes !== null && (
          <span className="text-sm font-semibold" style={{ color: "#2B5D4F" }}>
            {lockSoonText(soonMinutes).line}
          </span>
        )}
      </div>
      {countdownTo && (
        <span className="text-3xl font-bold tabular-nums" style={{ color }} aria-label="Thời gian còn lại">
          {clock(new Date(countdownTo).getTime() - nowMs)}
        </span>
      )}
    </div>
  );
}

/** Shared by Hôm nay and Góc học tập (R2): the break line and the break / free-time buttons. */
export function DayControls({
  s,
  brk,
  breakMinutes,
  busy,
  color,
  onAct,
}: {
  s: DayState;
  brk: { text: string; hint: string | null; button: string | null } | null;
  breakMinutes: number;
  busy: string | null;
  color: string;
  onAct: (a: Act) => Promise<boolean>;
}) {
  return (
    <>
      {brk && (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold">{brk.text}</span>
          {brk.hint && <span className="text-[13px] text-ink/70">{brk.hint}</span>}
        </div>
      )}
      {(s.break.canStart || s.free.canStart) && (
        <div className="flex flex-wrap gap-2">
          {s.free.canStart && (
            <button type="button" disabled={!!busy} onClick={() => void onAct({ url: "/api/day/free" })} className="btn text-white disabled:opacity-60" style={{ background: color }}>
              Bắt đầu giờ tự do
            </button>
          )}
          {s.break.canStart && (
            <button type="button" disabled={!!busy} onClick={() => void onAct({ url: "/api/day/break", body: { action: "start" } })} className="btn border-[1.5px] bg-white disabled:opacity-60" style={{ borderColor: color, color }}>
              {s.break.legacy ? `☕ Nghỉ ${breakMinutes} phút (1 lần/ngày)` : (brk?.button ?? `Nghỉ ${s.break.bankMinutes}'`)}
            </button>
          )}
        </div>
      )}
      {s.break.state === "running" && (
        <button type="button" disabled={!!busy} onClick={() => void onAct({ url: "/api/day/break", body: { action: "end" } })} className="btn self-start text-white disabled:opacity-60" style={{ background: color }}>
          Học tiếp
        </button>
      )}
    </>
  );
}
