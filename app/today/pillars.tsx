"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { activityText, findActivity, type Voice } from "@/lib/binhYen/catalog";
import { wordEmoji } from "@/lib/binhYen/emoji";
import type { DayState, TaskView } from "@/lib/dayState";
import { PLAY_IDEAS } from "@/lib/today/playIdeas";
import { readPlayPlan, writePlayPlan } from "@/lib/today/playPlan";
import type { TodayView } from "@/lib/today/service";
import { clock, dayMonth, dueLabel, leftCount, nextTask, taskMeta, vnTime } from "@/lib/today/view";
import { nextFromPlan } from "@/lib/today/week";
import type { WeekDay } from "@/lib/today/weekDays";
import { isWaiting, whereLine, type TaskCtx } from "./today-parts";

/**
 * R6d (artifact vHome, audit item I): the four areas of Hôm nay — Cảm xúc, Học tập, Kỹ năng,
 * Vui chơi — each with what to do next. Display only: every start goes through the same server
 * routes as the rest of the screen, and the server decides. The feeling line comes from the
 * child-only /api/week/days; the free-time plan lives in this browser only (parent 08/11).
 */

const ROW = "flex items-center justify-between gap-2.5 rounded-[14px] bg-[#ECEEE8] px-3 py-2.5";
const DONE_ROW = "flex items-center justify-between gap-2.5 rounded-[14px] bg-[#E3F0E7] px-3 py-2.5";
const soft = (color: string) => `color-mix(in srgb, ${color} 12%, white)`;

/** The group name shown on a task (same words as Góc học tập). */
export function groupLabel(i: TaskView): string {
  return i.source === "homework" ? (i.group === "upcoming" ? "Làm trước" : "Bài trên lớp") : i.part === 1 ? "Bài bổ sung" : "Kỹ năng";
}

/** The Part 1 task Hôm nay suggests next (same as the status card), else the first one left. */
export function pickNext(s: DayState, plan: string[] | null): TaskView | null {
  const n = nextFromPlan(s, plan) ?? nextTask(s);
  if (n && n.part === 1) return n;
  return s.part1.items.find((i) => i.state === "running") ?? s.part1.items.find((i) => i.state === "todo" && i.group !== "upcoming") ?? null;
}

const minutesLine = (i: TaskView) => (i.minMinutes > 0 ? `ít nhất ${i.minMinutes} phút` : "không giới hạn thời gian");

function defaultSub(item: TaskView, ctx: TaskCtx): string {
  if (item.state === "running") return taskMeta(item, ctx.nowMs, ctx.today);
  const due = item.dueDate ? (item.group === "upcoming" ? `Hạn ${dayMonth(item.dueDate)}` : dueLabel(item.dueDate, ctx.today)) : null;
  return [whereLine(item) || item.note, due, item.source === "template" ? minutesLine(item) : null].filter(Boolean).join(" · ");
}

/** One task line with its single action (Bắt đầu / Tiếp tục / Nộp ảnh bài). */
function TaskLine({ item, ctx, eyebrow, sub }: { item: TaskView; ctx: TaskCtx; eyebrow?: string; sub?: string }) {
  const waiting = isWaiting(item, ctx);
  const asked = item.state === "running" && !!item.runId && ctx.asked.has(item.runId);
  const line = waiting ? `Làm xong “${ctx.runningTimed?.title}” rồi bắt đầu việc này` : asked ? "Đang chờ bố mẹ xem…" : item.state === "running" ? defaultSub(item, ctx) : (sub ?? defaultSub(item, ctx));
  const btn = "min-h-11 shrink-0 rounded-full border-[1.5px] bg-white px-4 text-sm font-bold whitespace-nowrap disabled:opacity-50";
  const off = !!ctx.busy || ctx.paused;
  return (
    <div className={ROW}>
      <div className="flex min-w-0 flex-col gap-0.5">
        {eyebrow && (
          <span className="text-xs font-bold tracking-[0.07em] uppercase" style={{ color: ctx.color }}>
            {eyebrow}
          </span>
        )}
        <b className="break-words">{item.title}</b>
        {line && <span className="text-[13px] text-ink/75">{line}</span>}
      </div>
      {item.state === "todo" ? (
        <button
          type="button"
          disabled={off || waiting || item.placeholder}
          onClick={() => void ctx.onAct({ url: "/api/tasks/start", body: { source: item.source, id: item.id } })}
          className={btn}
          style={{ borderColor: ctx.color, color: ctx.color }}
        >
          Bắt đầu
        </button>
      ) : item.state === "running" && item.requiresProof ? (
        <button type="button" disabled={off} onClick={() => ctx.onProofOpen(item)} className={btn} style={{ borderColor: ctx.color, color: ctx.color }}>
          Nộp ảnh bài
        </button>
      ) : item.state === "running" ? (
        <button type="button" disabled={ctx.paused} onClick={ctx.onFocus} className={btn} style={{ borderColor: ctx.color, color: ctx.color }}>
          Tiếp tục
        </button>
      ) : null}
    </div>
  );
}

function Card({ n, name, tag, top, children }: { n: number; name: string; tag: string; top: string; children: React.ReactNode }) {
  return (
    <section role="listitem" aria-label={`${n} · ${name}`} className="flex min-w-0 flex-col gap-3 rounded-[20px] border border-ink/10 bg-white p-4" style={{ borderTop: `6px solid ${top}` }}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <h2 className="text-lg font-bold">
          {n} · {name}
        </h2>
        <span className="text-[13px] text-ink/70">{tag}</span>
      </header>
      {children}
    </section>
  );
}

// The free-time plan is read from this browser after hydration (server snapshot = none).
function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function usePlayPlan(date: string): [string | null, (v: string | null) => void] {
  const stored = useSyncExternalStore(
    subscribeStorage,
    () => readPlayPlan(date),
    () => null,
  );
  // Writes in this tab fire no "storage" event: keep what the child just tapped.
  const [mine, setMine] = useState<{ date: string; value: string | null } | null>(null);
  const plan = mine && mine.date === date ? mine.value : stored;
  return [
    plan,
    (value) => {
      writePlayPlan(date, value);
      setMine({ date, value });
    },
  ];
}

export function PillarCards({
  s,
  view,
  today,
  byEnabled,
  color,
  nowMs,
  freeMinutes,
  voice,
  ctx,
  onStudy,
}: {
  s: DayState;
  view: TodayView;
  today: WeekDay | null;
  byEnabled: boolean;
  color: string;
  nowMs: number;
  freeMinutes: number;
  voice: Voice;
  ctx: TaskCtx;
  onStudy: () => void;
}) {
  const [plan, setPlan] = usePlayPlan(s.localDate);
  const feel = today?.feel ?? null;
  const act = feel?.activity ? findActivity(feel.activity) : undefined;
  const next1 = pickNext(s, view.plan);
  const pct = s.part1.total ? Math.round((s.part1.done / s.part1.total) * 100) : 100;
  const skills = s.part2.items.filter((i) => !i.placeholder);
  const left = leftCount(s);
  const freeEnds = s.free.endsAt ? Date.parse(s.free.endsAt) : null;
  const freeRunning = s.free.startedAt !== null && freeEnds !== null && nowMs < freeEnds;

  return (
    <div role="list" aria-label="Bốn mảng hôm nay" className="grid gap-3.5 sm:grid-cols-2">
      {byEnabled && (
        <Card n={1} name="Cảm xúc" tag="Góc bình yên · chỉ con thấy" top="#4E8C63">
          {feel ? (
            <>
              <div className="flex items-center gap-2.5 rounded-[14px] bg-[#ECEEE8] px-3 py-2.5 text-sm">
                <span aria-hidden className="text-2xl">
                  {wordEmoji(feel.word, feel.quad)}
                </span>
                <span>
                  Hôm nay con đã ghé: <b>{feel.label || "Góc bình yên"}</b>
                  {act ? ` · ${activityText(act, voice).title} ✓` : ""}
                </span>
              </div>
              <Link href="/binh-yen" className="inline-flex min-h-11 items-center self-start text-sm font-semibold underline" style={{ color }}>
                Vào Góc bình yên lần nữa
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-ink/75">Trước khi học, trong lòng con thế nào? Chạm một vùng ở thẻ trên.</p>
              <Link href="/binh-yen" className="inline-flex min-h-11 items-center self-start text-sm font-semibold underline" style={{ color }}>
                Vào Góc bình yên
              </Link>
            </>
          )}
        </Card>
      )}

      <Card n={2} name="Học tập" tag={s.part1.total ? `${s.part1.done}/${s.part1.total} việc` : "không có bài"} top={color}>
        <div
          role="progressbar"
          aria-label="Bài tập hôm nay"
          aria-valuemin={0}
          aria-valuemax={Math.max(1, s.part1.total)}
          aria-valuenow={s.part1.total ? s.part1.done : 1}
          aria-valuetext={`${s.part1.done}/${s.part1.total} việc`}
          className="h-2.5 overflow-hidden rounded-full bg-[#ECEEE8]"
        >
          <div className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%`, background: color }} />
        </div>
        {next1 ? (
          <TaskLine item={next1} ctx={ctx} eyebrow={`Việc tiếp theo · ${groupLabel(next1)}`} />
        ) : (
          <div className={DONE_ROW}>
            <b className="text-[#24563A]">{s.part1.total ? "Xong hết bài hôm nay ✓" : "Hôm nay không có bài tập."}</b>
          </div>
        )}
        <button type="button" onClick={onStudy} className="btn self-start border-[1.5px] bg-white text-sm" style={{ borderColor: color, color }}>
          📚 Vào Góc học tập · xếp bài
        </button>
      </Card>

      <Card n={3} name="Kỹ năng" tag="làm song song" top="#4C70A8">
        {skills.length === 0 ? (
          <p className="text-sm text-ink/75">Hôm nay không có kỹ năng.</p>
        ) : (
          skills.map((i) =>
            i.state === "done" ? (
              <div key={i.key} className={DONE_ROW}>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <b className="break-words">{i.title}</b>
                  <span className="text-[13px] text-ink/75">{minutesLine(i)}</span>
                </div>
                <span className="shrink-0 text-sm font-bold whitespace-nowrap text-[#2F6E45]">✓ Xong</span>
              </div>
            ) : (
              <TaskLine key={i.key} item={i} ctx={ctx} sub={`${minutesLine(i)} · làm lúc nào cũng được`} />
            ),
          )
        )}
      </Card>

      <Card n={4} name="Vui chơi" tag={`Giờ tự do ${freeMinutes}'`} top="#7A4FA0">
        {s.free.startedAt === null ? (
          <>
            <p className="text-sm text-ink/75">
              {left > 0
                ? `Còn ${left} việc nữa là có ${freeMinutes} phút của con. Chọn trước con sẽ làm gì:`
                : s.free.canStart
                  ? "Xong hết rồi! Bấm “Bắt đầu giờ tự do” ở thẻ bên dưới khi con muốn. Chọn trước con sẽ làm gì:"
                  : "Chọn trước con sẽ làm gì:"}
            </p>
            <div role="group" aria-label="Giờ tự do con định làm gì" className="flex flex-wrap gap-2">
              {PLAY_IDEAS[voice].map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={plan === p}
                  onClick={() => setPlan(plan === p ? null : p)}
                  className="min-h-11 rounded-full border-[1.5px] px-3.5 text-sm"
                  style={plan === p ? { borderColor: color, background: soft(color), fontWeight: 700 } : { borderColor: "#D3D8D0", background: "#fff" }}
                >
                  {p}
                </button>
              ))}
            </div>
          </>
        ) : freeRunning && freeEnds !== null ? (
          <div className="flex flex-col gap-1 rounded-[14px] px-3.5 py-3" style={{ background: soft(color) }}>
            <b>Giờ tự do đang chạy · {clock(freeEnds - nowMs)}</b>
            <span className="text-sm">
              Máy mở mọi trang.{plan ? ` Con định: ${plan}.` : ""}
            </span>
          </div>
        ) : (
          <p className="text-sm text-ink/75">
            Đã dùng giờ tự do hôm nay (từ {vnTime(s.free.startedAt)}).{plan ? ` Con định: ${plan}.` : ""}
          </p>
        )}
      </Card>
    </div>
  );
}
