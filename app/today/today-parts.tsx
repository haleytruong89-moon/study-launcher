"use client";

import type { DayState, TaskView } from "@/lib/dayState";
import { KIND_LABEL, type AttachmentView } from "@/lib/files";
import { addDays } from "@/lib/time";
import { elapsedMs, minutesLabel, todayLine } from "@/lib/today/focus";
import { extraRunView, isExtraRun } from "@/lib/today/rules";
import { dayLabel, dayMonth, dueLabel, dueTone, earlyUntil, isOkResult, taskMeta } from "@/lib/today/view";

export type Act = { url: string; body?: unknown; confirm?: string };

/** Everything a task control needs (passed down from the screen). */
export interface TaskCtx {
  today: string;
  nowMs: number;
  busy: string | null;
  /** R1 E8: the 10' break is running, so every task button pauses ("Học tiếp" resumes). */
  paused: boolean;
  color: string;
  files: (item: TaskView) => AttachmentView[];
  /** A timed task already running: other timed tasks wait (one at a time). */
  runningTimed: TaskView | null;
  onAct: (a: Act) => Promise<unknown>;
  /** Opens "Nộp ảnh bài" for a running homework. */
  onProofOpen: (item: TaskView) => void;
  /** Homework already done in the notebook: start it (no focus screen) and open "Nộp ảnh bài". */
  onDoneNow: (item: TaskView) => void;
  /** Opens the focus view; with an item, that running item (not only the suggested one). */
  onFocus: (item?: TaskView) => void;
  /** Run ids a parent has looked at ("Bố mẹ đã xem ✓"). */
  reviewed: ReadonlySet<string>;
  /** Run ids waiting for "Nhờ bố mẹ xem trực tiếp". */
  asked: ReadonlySet<string>;
}

export const isAsked = (item: TaskView, ctx: TaskCtx) => item.state === "running" && !!item.runId && ctx.asked.has(item.runId);
/** Photos already sent but not finished yet (e.g. the connection dropped): offer "Xong". */
export const canFinishWithPhotos = (item: TaskView) => item.state === "running" && item.requiresProof && item.proofCount > 0;

export function FinishButton({ item, ctx, className, style }: { item: TaskView; ctx: TaskCtx; className: string; style?: React.CSSProperties }) {
  return (
    <button type="button" disabled={(!!ctx.busy || ctx.paused)} onClick={() => void ctx.onAct({ url: "/api/tasks/finish", body: { runId: item.runId } })} className={className} style={style}>
      Xong · đã gửi {item.proofCount} ảnh
    </button>
  );
}

const TONE = {
  urgent: { dot: "#8A2B1F", text: "#8A2B1F", chipBg: "#F7E4E0" },
  soon: { dot: "#C78A12", text: "#6B4500", chipBg: "#FBF0D6" },
  later: { dot: "#9AA19C", text: "#4A4F4C", chipBg: "#EEF0EC" },
} as const;

/** A timed task that waits for another running timed task (one at a time). */
export function isWaiting(item: TaskView, ctx: TaskCtx): boolean {
  return item.state === "todo" && ctx.runningTimed !== null && ctx.runningTimed.key !== item.key && item.source === "template" && item.minMinutes > 0;
}

/**
 * R6a (parent 08/11: "Practice ghi chung chung"): which subject and which app a set task is,
 * e.g. "Toán · trên Khan Academy". Empty for homework (its title is already the subject).
 */
export function whereLine(item: TaskView): string {
  if (item.source !== "template") return "";
  const subject = item.subject && item.subject.trim().toLowerCase() !== item.title.trim().toLowerCase() ? item.subject.trim() : null;
  return [subject, item.appLabel ? `trên ${item.appLabel}` : null].filter(Boolean).join(" · ");
}

function subLine(item: TaskView, ctx: TaskCtx): string {
  if (isWaiting(item, ctx)) return `Làm xong “${ctx.runningTimed?.title}” rồi bắt đầu việc này`;
  if (item.state === "todo" && item.source === "homework" && item.dueDate) {
    const due = item.group === "upcoming" ? `Hạn ${dayMonth(item.dueDate)}` : dueLabel(item.dueDate, ctx.today);
    return item.note ? `${due} · ${item.note}` : due;
  }
  if (item.state === "todo" && item.source === "template") {
    const time = item.minMinutes > 0 ? `ít nhất ${item.minMinutes} phút` : "không giới hạn thời gian";
    const where = whereLine(item);
    return where ? `${where} · ${time}` : time.charAt(0).toUpperCase() + time.slice(1);
  }
  // The "★ sớm" badge on the right already says it.
  return taskMeta(item, ctx.nowMs, ctx.today).replace(" · ★ sớm", "");
}

/** Opens "Nộp ảnh bài" (photos are picked, checked and sent in the sheet). */
export function ProofButton({ item, ctx, big = false }: { item: TaskView; ctx: TaskCtx; big?: boolean }) {
  return (
    <button
      type="button"
      disabled={(!!ctx.busy || ctx.paused)}
      onClick={() => ctx.onProofOpen(item)}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-bold text-white disabled:opacity-60 ${big ? "min-h-14 w-full text-[17px]" : "min-h-11 px-4 text-sm"}`}
      style={{ background: big ? "rgba(255,255,255,0.18)" : "#1c1f1d" }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
      Nộp ảnh bài
    </button>
  );
}

export function FileLinks({ files, dark = false }: { files: AttachmentView[]; dark?: boolean }) {
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

/**
 * R6c (artifact workPanel): the homework files folded under "📎 Xem đề bài" — open when the
 * child wants them, so the buttons stay in view.
 */
export function FilesFold({ files }: { files: AttachmentView[] }) {
  if (files.length === 0) return null;
  return (
    <details className="group">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-xl bg-[#ECEEE8] px-3 text-sm font-semibold select-none [&::-webkit-details-marker]:hidden">
        📎 Xem đề bài ({files.length})
        <span aria-hidden className="text-xs transition-transform group-open:rotate-180 motion-reduce:transition-none">
          ▾
        </span>
      </summary>
      <div className="mt-2">
        <FileLinks files={files} />
      </div>
    </details>
  );
}

/**
 * R8a: the line under a done template: "Hôm nay: 1 giờ 30 phút · 2 lần", or "Đang làm thêm · 12
 * phút" while a "Làm thêm" run runs (minutes only, on the server clock).
 */
export function doneLine(item: TaskView, nowMs: number): string {
  const run = extraRunView(item);
  return run ? `Đang làm thêm · ${minutesLabel(elapsedMs(run, nowMs))}` : todayLine(item);
}

/**
 * R8a "Làm thêm" (parent 08/11/2026): a done supplementary task or skill may be done again. The
 * button starts an extra run (server route, server clock); while it runs: 🎯 Tập trung and Xong at
 * once (no minimum). It never changes what is done or what is open. Never shown for homework.
 */
export function LamThem({ item, ctx }: { item: TaskView; ctx: TaskCtx }) {
  if (item.source !== "template" || item.state !== "done") return null;
  const run = extraRunView(item);
  const off = !!ctx.busy || ctx.paused;
  const btn = "min-h-11 shrink-0 rounded-full border-[1.5px] bg-white px-4 text-sm font-bold whitespace-nowrap disabled:opacity-50";
  if (run) {
    return (
      <span className="flex flex-wrap justify-end gap-2">
        <button type="button" aria-label={`Tập trung: ${item.title}`} disabled={ctx.paused} onClick={() => ctx.onFocus(run)} className={btn} style={{ borderColor: ctx.color, color: ctx.color }}>
          🎯 Tập trung
        </button>
        <button
          type="button"
          aria-label={`Xong làm thêm: ${item.title}`}
          disabled={off}
          onClick={() => void ctx.onAct({ url: "/api/tasks/finish", body: { runId: run.runId } })}
          className="min-h-11 shrink-0 rounded-full px-4 text-sm font-bold whitespace-nowrap text-white disabled:opacity-50"
          style={{ background: ctx.color }}
        >
          Xong
        </button>
      </span>
    );
  }
  // One timed task at a time: an extra run waits for the running one (the server checks too).
  const other = ctx.runningTimed;
  return (
    <button
      type="button"
      aria-label={`Làm thêm: ${item.title}`}
      title={other ? `Làm xong “${other.title}” rồi làm thêm` : undefined}
      disabled={off || other !== null}
      onClick={() => void ctx.onAct({ url: "/api/tasks/start", body: { source: item.source, id: item.id } })}
      className={btn}
      style={{ borderColor: ctx.color, color: ctx.color }}
    >
      Làm thêm
    </button>
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
            disabled={(!!ctx.busy || ctx.paused) || locked || waiting}
            onClick={() => void ctx.onAct({ url: "/api/tasks/start", body: { source: item.source, id: item.id } })}
            className="min-h-11 rounded-full border-[1.5px] bg-white px-4 text-sm font-bold disabled:opacity-50"
            style={upcoming ? { borderColor: "rgba(28,31,29,0.3)" } : { borderColor: ctx.color, color: ctx.color }}
          >
            {upcoming ? "Làm trước" : "Bắt đầu"}
          </button>
        )}
        {item.state === "todo" && item.requiresProof && (
          <button
            type="button"
            disabled={(!!ctx.busy || ctx.paused) || locked}
            onClick={() => ctx.onDoneNow(item)}
            className="min-h-11 rounded-full bg-ink px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            Xong rồi · nộp ảnh
          </button>
        )}
        {isAsked(item, ctx) && <span className="rounded-full bg-[#FBE9D3] px-3 py-2 text-[13px] font-bold text-[#6B3A0A]">Đang chờ bố mẹ xem…</span>}
        {canFinishWithPhotos(item) ? (
          <FinishButton item={item} ctx={ctx} className="min-h-11 rounded-full bg-ink px-4 text-sm font-bold text-white disabled:opacity-50" />
        ) : (
          running && item.requiresProof && <ProofButton item={item} ctx={ctx} />
        )}
        {running && (
          <button type="button" aria-label={`Tập trung: ${item.title}`} disabled={ctx.paused} onClick={() => ctx.onFocus(item)} className="min-h-11 rounded-full px-4 text-sm font-bold text-white disabled:opacity-50" style={{ background: ctx.color }}>
            🎯 Tập trung
          </button>
        )}
        {done && (
          <span className="flex flex-col items-end gap-1">
            <span className="rounded-full bg-[#DCEAE4] px-3 py-2 text-[13px] font-bold text-[#1C3F35]">{item.early ? "✓ Xong · ★ sớm" : "✓ Xong"}</span>
            {item.runId && ctx.reviewed.has(item.runId) && <span className="text-xs font-semibold text-accent">Bố mẹ đã xem ✓</span>}
          </span>
        )}
      </div>
    </li>
  );
}

/** Big "Việc tiếp theo" block inside the status card. */
export function NextTask({ item, ctx, label = "Việc tiếp theo" }: { item: TaskView; ctx: TaskCtx; label?: string }) {
  const files = ctx.files(item);
  const tone = item.dueDate ? TONE[dueTone(item.dueDate, ctx.today)] : null;
  const kind = item.source === "homework" ? (item.group === "upcoming" ? "Bài trên lớp · làm trước" : "Bài trên lớp") : item.part === 1 ? "Bài bổ sung" : "Kỹ năng";
  const extra = isExtraRun(item); // R8a
  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-bold tracking-[0.08em] uppercase" style={{ color: ctx.color }}>
        {extra ? "Đang làm thêm" : label}
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-[23px] leading-tight font-bold">{item.title}</div>
        <div className="text-[15px] text-ink/80">
          {kind}
          {whereLine(item) ? ` · ${whereLine(item)}` : ""}
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
          {item.requiresProof ? "Cần ảnh bài làm" : extra ? "Không bắt buộc — làm bao lâu cũng được" : item.minMinutes > 0 ? `Ít nhất ${item.minMinutes} phút` : "Không giới hạn thời gian"}
        </span>
      </div>
      <FilesFold files={files} />
      {item.deepLink && (
        <a href={item.deepLink} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-bg px-3 text-sm font-semibold text-ink no-underline">
          Mở {item.appLabel ?? "app"} ↗
        </a>
      )}
      <TaskActions item={item} ctx={ctx} />
    </div>
  );
}

/**
 * The main buttons of a task (Bắt đầu / Làm xong trong vở rồi / Nộp ảnh bài / Xong · đã gửi /
 * Xong / 🎯 Tập trung). Shared by "Việc tiếp theo" on Hôm nay and the work panel of Góc học tập.
 * R7a: the focus screen is optional, so a timed task that is ready can be finished right here
 * (same /api/tasks/finish route; the server still checks the minimum).
 */
export function TaskActions({ item, ctx }: { item: TaskView; ctx: TaskCtx }) {
  const waiting = isWaiting(item, ctx);
  if (item.state === "todo") {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={(!!ctx.busy || ctx.paused) || waiting || item.placeholder}
          onClick={() => void ctx.onAct({ url: "/api/tasks/start", body: { source: item.source, id: item.id } })}
          className="min-h-14 rounded-2xl text-[17px] font-bold text-white disabled:opacity-50"
          style={{ background: ctx.color }}
        >
          Bắt đầu
        </button>
        {item.requiresProof && (
          <button type="button" disabled={(!!ctx.busy || ctx.paused)} onClick={() => ctx.onDoneNow(item)} className="min-h-12 rounded-2xl border-[1.5px] border-ink/25 bg-white text-base font-bold disabled:opacity-50">
            Làm xong trong vở rồi · nộp ảnh
          </button>
        )}
      </div>
    );
  }
  if (item.requiresProof) {
    return (
      <div className="flex flex-col gap-2">
        {isAsked(item, ctx) && <p className="rounded-xl bg-[#FBE9D3] px-3 py-2 text-sm font-semibold text-[#6B3A0A]">Đã nhờ bố mẹ xem. Bố mẹ bấm xác nhận là bài này xong.</p>}
        {canFinishWithPhotos(item) ? (
          <FinishButton item={item} ctx={ctx} className="min-h-14 rounded-2xl text-[17px] font-bold text-white disabled:opacity-50" style={{ background: ctx.color }} />
        ) : (
          <button type="button" disabled={(!!ctx.busy || ctx.paused)} onClick={() => ctx.onProofOpen(item)} className="min-h-14 rounded-2xl text-[17px] font-bold text-white disabled:opacity-50" style={{ background: ctx.color }}>
            Nộp ảnh bài
          </button>
        )}
        <button type="button" disabled={ctx.paused} onClick={() => ctx.onFocus(item)} className="min-h-12 rounded-2xl border-[1.5px] border-ink/25 bg-white text-base font-bold disabled:opacity-50">
          🎯 Tập trung
        </button>
      </div>
    );
  }
  // A placeholder / not-started item has nothing to focus on (no dead button).
  if (item.state !== "running") return null;
  const ready = !item.canFinishAt || Date.parse(item.canFinishAt) <= ctx.nowMs;
  const focus = (
    <button
      type="button"
      disabled={ctx.paused}
      onClick={() => ctx.onFocus(item)}
      className={`rounded-2xl font-bold disabled:opacity-50 ${ready ? "min-h-12 border-[1.5px] border-ink/25 bg-white text-base" : "min-h-14 text-[17px] text-white"}`}
      style={ready ? undefined : { background: ctx.color }}
    >
      🎯 Tập trung
    </button>
  );
  if (!ready) return focus;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={!!ctx.busy || ctx.paused}
        onClick={() => void ctx.onAct({ url: "/api/tasks/finish", body: { runId: item.runId } })}
        className="min-h-14 rounded-2xl text-[17px] font-bold text-white disabled:opacity-50"
        style={{ background: ctx.color }}
      >
        Xong
      </button>
      {focus}
    </div>
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
