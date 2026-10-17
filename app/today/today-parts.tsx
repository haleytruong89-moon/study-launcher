"use client";

import type { DayState, TaskView } from "@/lib/dayState";
import { KIND_LABEL, type AttachmentView } from "@/lib/files";
import { addDays } from "@/lib/time";
import { clock, dayLabel, dayMonth, dueLabel, dueTone, earlyUntil, isOkResult, taskMeta, taskProgress } from "@/lib/today/view";

export type Act = { url: string; body?: unknown; confirm?: string };

/** Everything a task control needs (passed down from the screen). */
export interface TaskCtx {
  today: string;
  nowMs: number;
  busy: string | null;
  color: string;
  files: (item: TaskView) => AttachmentView[];
  /** A timed task already running: other timed tasks wait (one at a time). */
  runningTimed: TaskView | null;
  onAct: (a: Act) => Promise<unknown>;
  onProof: (item: TaskView, file: File) => Promise<void>;
  onFocus: () => void;
}

const TONE = {
  urgent: { dot: "#8A2B1F", text: "#8A2B1F", chipBg: "#F7E4E0" },
  soon: { dot: "#C78A12", text: "#6B4500", chipBg: "#FBF0D6" },
  later: { dot: "#9AA19C", text: "#4A4F4C", chipBg: "#EEF0EC" },
} as const;

function isWaiting(item: TaskView, ctx: TaskCtx): boolean {
  return item.state === "todo" && ctx.runningTimed !== null && ctx.runningTimed.key !== item.key && item.source === "template" && item.minMinutes > 0;
}

function subLine(item: TaskView, ctx: TaskCtx): string {
  if (isWaiting(item, ctx)) return `Làm xong “${ctx.runningTimed?.title}” rồi bắt đầu việc này`;
  if (item.state === "todo" && item.source === "homework" && item.dueDate) {
    const due = item.group === "upcoming" ? `Hạn ${dayMonth(item.dueDate)}` : dueLabel(item.dueDate, ctx.today);
    return item.note ? `${due} · ${item.note}` : due;
  }
  if (item.state === "todo" && item.source === "template") return item.minMinutes > 0 ? `Ít nhất ${item.minMinutes} phút` : "Không giới hạn thời gian";
  // The "★ sớm" badge on the right already says it.
  return taskMeta(item, ctx.nowMs, ctx.today).replace(" · ★ sớm", "");
}

/** Proof photo picker (homework): compress + upload + finish happen in the screen. */
export function ProofButton({ item, ctx, big = false }: { item: TaskView; ctx: TaskCtx; big?: boolean }) {
  const sending = ctx.busy === `proof:${item.runId}`;
  return (
    <label
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl font-bold text-white ${big ? "min-h-14 w-full text-[17px]" : "min-h-11 px-4 text-sm"} ${ctx.busy ? "pointer-events-none opacity-60" : ""}`}
      style={{ background: big ? "rgba(255,255,255,0.18)" : "#1c1f1d" }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
      {sending ? "Đang gửi ảnh…" : "Chụp ảnh bài đã làm"}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void ctx.onProof(item, f);
        }}
      />
    </label>
  );
}

function FileLinks({ files, dark = false }: { files: AttachmentView[]; dark?: boolean }) {
  if (files.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {files.map((f, i) => {
        const n = i + 1;
        return (
          <a
            key={f.path}
            href={f.url}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold no-underline ${dark ? "bg-white/10 text-white" : "bg-bg text-ink"}`}
          >
            {KIND_LABEL[f.kind]} {n} ↗
          </a>
        );
      })}
    </span>
  );
}

/** One row of a task list (homework, extra, upcoming or skill). */
export function TaskRow({ item, ctx, locked = false }: { item: TaskView; ctx: TaskCtx; locked?: boolean }) {
  const done = item.state === "done";
  const running = item.state === "running";
  const upcoming = item.group === "upcoming";
  const waiting = isWaiting(item, ctx);
  const tone = item.dueDate ? TONE[dueTone(item.dueDate, ctx.today)] : null;
  const starUntil = upcoming && item.dueDate && !done ? earlyUntil(item.dueDate, ctx.today) : null;
  const files = ctx.files(item);
  const image = files.find((f) => f.kind === "image");

  return (
    <li
      aria-label={item.title}
      className={`flex flex-wrap items-center gap-3 rounded-2xl bg-white px-3.5 py-3 ${upcoming && !done ? "border border-dashed border-ink/25" : "border border-ink/10"} ${running ? "ring-2" : ""} ${locked && item.state === "todo" ? "opacity-60" : ""}`}
      style={running ? ({ "--tw-ring-color": ctx.color } as React.CSSProperties) : undefined}
    >
      {done ? (
        <span aria-hidden className="pop flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
          ✓
        </span>
      ) : tone && !upcoming ? (
        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: tone.dot }} />
      ) : null}
      {image && !done && (
        <a href={image.url} target="_blank" rel="noreferrer" className="shrink-0" aria-label={`Xem ảnh bài ${item.title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- private file streamed by our own route */}
          <img src={image.url} alt="" className="size-12 rounded-lg object-cover" />
        </a>
      )}
      <div className="flex min-w-0 grow basis-48 flex-col gap-1">
        <span className={`text-base font-bold ${done ? "text-ink/55 line-through" : ""}`}>
          {item.title}
          {item.placeholder && <span className="ml-2 rounded-full bg-[#ECEDE8] px-2 py-0.5 text-xs font-bold text-ink/70">Đang xây</span>}
        </span>
        <span className="text-[13px] font-medium" style={{ color: tone && !done && !upcoming && !waiting ? tone.text : "#4A4F4C" }}>
          {subLine(item, ctx)}
        </span>
        {starUntil && (
          <span className="self-start rounded-full bg-[#FBF0D6] px-2 py-0.5 text-xs font-bold text-[#6B4500]">★ nếu xong đến hết {starUntil.slice(8, 10)}/{starUntil.slice(5, 7)}</span>
        )}
        {!done && files.filter((f) => f !== image).length > 0 && <FileLinks files={files.filter((f) => f !== image)} />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {item.state === "todo" && (
          <button
            type="button"
            disabled={!!ctx.busy || locked || waiting}
            onClick={() => void ctx.onAct({ url: "/api/tasks/start", body: { source: item.source, id: item.id } })}
            className="min-h-11 rounded-full border-[1.5px] bg-white px-4 text-sm font-bold disabled:opacity-50"
            style={upcoming ? { borderColor: "rgba(28,31,29,0.3)" } : { borderColor: ctx.color, color: ctx.color }}
          >
            {upcoming ? "Làm trước" : "Bắt đầu"}
          </button>
        )}
        {running && (
          <button type="button" onClick={ctx.onFocus} className="min-h-11 rounded-full px-4 text-sm font-bold text-white" style={{ background: ctx.color }}>
            Đang làm · mở
          </button>
        )}
        {done && <span className="rounded-full bg-[#DCEAE4] px-3 py-2 text-[13px] font-bold text-[#1C3F35]">{item.early ? "✓ Xong · ★ sớm" : "✓ Xong"}</span>}
      </div>
    </li>
  );
}

/** Big "Việc tiếp theo" block inside the status card. */
export function NextTask({ item, ctx }: { item: TaskView; ctx: TaskCtx }) {
  const files = ctx.files(item);
  const tone = item.dueDate ? TONE[dueTone(item.dueDate, ctx.today)] : null;
  const kind = item.source === "homework" ? (item.group === "upcoming" ? "Bài trên lớp · làm trước" : "Bài trên lớp") : item.part === 1 ? "Bài bổ sung" : "Kỹ năng";
  const waiting = isWaiting(item, ctx);
  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-bold tracking-[0.08em] uppercase" style={{ color: ctx.color }}>
        Việc tiếp theo
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-[23px] leading-tight font-bold">{item.title}</div>
        <div className="text-[15px] text-ink/80">
          {kind}
          {item.note ? ` · ${item.note}` : ""}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {item.dueDate && tone && (
          <span className="rounded-full px-2.5 py-1 text-[13px] font-bold" style={{ background: tone.chipBg, color: tone.text }}>
            {dueLabel(item.dueDate, ctx.today)}
          </span>
        )}
        <span className="rounded-full bg-[#EEF0EC] px-2.5 py-1 text-[13px] font-semibold text-ink/80">
          {item.requiresProof ? "Cần ảnh bài làm" : item.minMinutes > 0 ? `Ít nhất ${item.minMinutes} phút` : "Không giới hạn thời gian"}
        </span>
      </div>
      <FileLinks files={files} />
      {item.deepLink && (
        <a href={item.deepLink} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-bg px-3 text-sm font-semibold text-ink no-underline">
          Mở app ↗
        </a>
      )}
      {item.state === "todo" ? (
        <button
          type="button"
          disabled={!!ctx.busy || waiting || item.placeholder}
          onClick={() => void ctx.onAct({ url: "/api/tasks/start", body: { source: item.source, id: item.id } })}
          className="min-h-14 rounded-2xl text-[17px] font-bold text-white disabled:opacity-50"
          style={{ background: ctx.color }}
        >
          Bắt đầu
        </button>
      ) : (
        <button type="button" onClick={ctx.onFocus} className="min-h-14 rounded-2xl text-[17px] font-bold text-white" style={{ background: ctx.color }}>
          Đang làm · mở màn tập trung
        </button>
      )}
    </div>
  );
}

/** Full-screen focus mode while a task runs: big timer, open app, finish / proof. */
export function FocusView({ item, ctx, dark, onClose }: { item: TaskView; ctx: TaskCtx; dark: string; onClose: () => void }) {
  const started = item.startedAt ? new Date(item.startedAt).getTime() : ctx.nowMs;
  const elapsed = ctx.nowMs - started;
  const timed = !item.requiresProof && item.minMinutes > 0;
  const pct = timed ? taskProgress(item, ctx.nowMs) : 100;
  const remaining = item.canFinishAt ? new Date(item.canFinishAt).getTime() - ctx.nowMs : 0;
  const ready = !item.requiresProof && remaining <= 0;
  const R = 120;
  const C = 2 * Math.PI * R;
  const kind = item.source === "homework" ? "Bài trên lớp · chụp ảnh khi xong" : `${item.part === 1 ? "Bài bổ sung" : "Kỹ năng"}${item.minMinutes > 0 ? ` · ít nhất ${item.minMinutes} phút` : ""}`;

  return (
    <section role="dialog" aria-modal="true" aria-label="Đang tập trung" className="fixed inset-0 z-50 overflow-y-auto text-white" style={{ background: dark }}>
      <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5 pt-5 pb-7">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-white/80">
            <span className="size-2 rounded-full bg-white/80" aria-hidden />
            Đang tập trung
          </span>
          <button type="button" onClick={onClose} className="min-h-11 rounded-full border-[1.5px] border-white/40 px-4 text-sm font-semibold">
            Thu nhỏ
          </button>
        </div>
        <div className="mt-2 flex flex-col gap-1 text-center">
          <h2 className="text-[26px] font-bold">{item.title}</h2>
          <p className="text-[15px] text-white/80">{kind}</p>
          {item.note && <p className="text-[15px] text-white/90">{item.note}</p>}
        </div>
        <div className="relative size-[270px] self-center">
          <svg width="270" height="270" viewBox="0 0 270 270" role="img" aria-label={`Đã làm ${clock(elapsed)}`}>
            <circle cx="135" cy="135" r={R} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="14" />
            <circle
              cx="135"
              cy="135"
              r={R}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${(C * pct) / 100} ${C}`}
              transform="rotate(-90 135 135)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <span className="text-6xl font-bold tracking-tight tabular-nums">{clock(elapsed)}</span>
            <span className="text-[15px] text-white/80">đã làm</span>
          </div>
        </div>
        {timed && (
          <p className="text-center text-base text-white/90" aria-live="polite">
            {ready ? (
              <>Đủ {item.minMinutes} phút — làm xong thì bấm Xong</>
            ) : (
              <>
                Còn <strong className="text-white tabular-nums">{clock(remaining)}</strong> nữa là bấm Xong được
              </>
            )}
          </p>
        )}
        <FileLinks files={ctx.files(item)} dark />
        {item.deepLink && (
          <a href={item.deepLink} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white/10 text-[15px] font-semibold text-white no-underline">
            Mở app ↗
          </a>
        )}
        {item.requiresProof ? (
          <ProofButton item={item} ctx={ctx} big />
        ) : (
          <button
            type="button"
            disabled={!ready || !!ctx.busy}
            onClick={() => void ctx.onAct({ url: "/api/tasks/finish", body: { runId: item.runId } })}
            className="min-h-14 rounded-2xl text-[17px] font-bold disabled:bg-white/15 disabled:text-white/70"
            style={ready ? { background: "#FFFFFF", color: dark } : undefined}
          >
            {ready ? "Xong" : `Xong · mở sau ${clock(remaining)}`}
          </button>
        )}
      </div>
    </section>
  );
}

/** Header ring: done / total required tasks of the day. */
export function ProgressRing({ done, total }: { done: number; total: number }) {
  const R = 26;
  const C = 2 * Math.PI * R;
  const pct = total === 0 ? 1 : done / total;
  return (
    <div className="relative size-16 shrink-0">
      <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`Đã xong ${done} trên ${total} việc hôm nay`}>
        <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="7" />
        <circle cx="32" cy="32" r={R} fill="none" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 32 32)" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-base font-bold">
          {done}/{total}
        </span>
        <span className="text-[10px] opacity-90">việc</span>
      </div>
    </div>
  );
}

/** Week strip: days before the child started using the app show "—" (not a miss). */
export function WeekStrip({ week, today, firstDay, color }: { week: DayState["week"]; today: string; firstDay: string; color: string }) {
  return (
    <ol aria-label="7 ngày qua" className="grid grid-cols-7 gap-1 text-center">
      {week.map((d) => {
        const before = d.date < firstDay;
        const ok = isOkResult(d.result);
        const title = before
          ? "Chưa dùng app"
          : d.result === "pass"
            ? "Dùng thẻ miễn — tính là đạt"
            : d.result === "sick"
              ? "Ngày ốm — tính là đạt"
              : ok
                ? "Đạt"
                : d.result === "today"
                  ? "Hôm nay"
                  : "Chưa đạt";
        const isToday = d.result === "today" || d.date === today;
        return (
          <li key={d.date} className="flex flex-col items-center gap-1" title={title}>
            <span className={`text-xs ${isToday ? "font-bold" : "text-ink/70"}`} style={isToday ? { color } : undefined}>
              {dayLabel(d.date, "")}
            </span>
            <span
              aria-label={title}
              className={`flex size-[34px] items-center justify-center rounded-full text-sm font-bold ${d.result === "pass" ? "border-2 border-dashed" : ""}`}
              style={
                before
                  ? { background: "#EEF0EC", color: "#4A4F4C" }
                  : d.result === "ok" || d.result === "sick"
                    ? { background: "#2b5d4f", color: "#fff" }
                    : d.result === "pass"
                      ? { borderColor: "#2b5d4f", color: "#2b5d4f" }
                      : d.result === "today"
                        ? { border: `2.5px solid ${color}`, color, background: "#fff" }
                        : { border: "1.5px dashed rgba(28,31,29,0.3)" }
              }
            >
              {before ? "–" : d.result === "pass" ? "M" : d.result === "sick" ? "Ố" : ok ? "✓" : d.result === "today" ? "nay" : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** "Thứ Hai ... Chủ Nhật" range text for the week card title. */
export function weekRange(today: string): string {
  const first = addDays(today, -6);
  return `${first.slice(8, 10)}/${first.slice(5, 7)} – ${today.slice(8, 10)}/${today.slice(5, 7)}`;
}
