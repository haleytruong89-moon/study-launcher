"use client";

import { useEffect, useRef, useState } from "react";
import type { DayState, TaskView } from "@/lib/dayState";
import { dropOrder } from "@/lib/today/reorder";
import type { TodayView } from "@/lib/today/service";
import { studyTimerLabel } from "@/lib/today/focus";
import { extraRunView, isExtraRun, runningItems } from "@/lib/today/rules";
import { dayMonth, dueLabel, groupLabel, leftCount, timerMs, upcomingHint } from "@/lib/today/view";
import { plannable } from "@/lib/today/week";
import { FilesFold, LamThem, TaskActions, TaskRow, doneLine, isWaiting, whereLine, type TaskCtx } from "./today-parts";

/**
 * Góc học tập (R2 §3, R6c: artifact vStudy / workPanel, audit items K and L). The child puts
 * today's tasks in the order they like (drag ⋮⋮ or ↑ ↓) and works on one at a time in the work
 * panel. Display only: the order is saved through /api/day/plan and never changes the lock;
 * every start / finish goes through the same server routes as Hôm nay, on the server clock.
 */

const SOFT_ROW = "#ECEEE8";
const soft = (color: string) => `color-mix(in srgb, ${color} 12%, white)`;

/** Today's tasks in the child's order (the saved plan first, then the rest in the usual order). */
export function orderedToday(s: DayState, plan: string[] | null): TaskView[] {
  const items = plannable(s).filter((i) => i.group !== "upcoming");
  if (!plan) return items;
  const pos = new Map(plan.map((k, n) => [k, n]));
  return [...items].sort((a, b) => (pos.get(a.key) ?? 1e6 + items.indexOf(a)) - (pos.get(b.key) ?? 1e6 + items.indexOf(b)));
}

/** The group pill of a row (artifact .gtag). */
function tagLabel(i: TaskView): string {
  return i.group === "upcoming" ? "Làm trước ★" : groupLabel(i);
}

/** Pill colours (spec R6c): homework = the child's colour, extra grey, skill blue, early gold. */
export function tagColor(i: TaskView, color: string): string {
  if (i.source === "homework") return i.group === "upcoming" ? "#A87A0E" : color;
  return i.part === 1 ? "#6A706B" : "#4C70A8";
}

function dueText(i: TaskView, today: string): string | null {
  if (!i.dueDate) return null;
  return i.group === "upcoming" ? `Hạn ${dayMonth(i.dueDate)}` : dueLabel(i.dueDate, today);
}

/** "{note / where} · {due} · ≥ N phút" under a row title. */
function rowSub(i: TaskView, ctx: TaskCtx): string {
  if (i.state === "running" && i.runId && ctx.asked.has(i.runId)) return "Đang chờ bố mẹ xem…";
  if (i.state === "done" && i.source === "template") return doneLine(i, ctx.nowMs); // R8a
  return [whereLine(i) || i.note, dueText(i, ctx.today), i.minMinutes > 0 && !i.requiresProof ? `≥ ${i.minMinutes} phút` : null].filter(Boolean).join(" · ");
}

export function StudyCorner({
  s,
  view,
  ctx,
  color,
  busy,
  paused,
  onSavePlan,
  suggested,
  focus,
}: {
  s: DayState;
  view: TodayView;
  /** What Hôm nay suggests next (plan, then the usual order — upcoming picks included). */
  suggested: TaskView | null;
  ctx: TaskCtx;
  color: string;
  busy: boolean;
  paused: boolean;
  onSavePlan: (keys: string[]) => Promise<boolean>;
  /** "Chỉ hiện bài này" (toggled in the page header): only the work panel, centred. */
  focus: boolean;
}) {
  // The order the child just made, shown at once while the server saves it. It belongs to the
  // plan it was made from: a new view from the server (saved, or polled) replaces it.
  const [draft, setDraft] = useState<{ base: string[] | null; keys: string[] } | null>(null);
  const plan = draft && draft.base === view.plan ? draft.keys : view.plan;
  const list = orderedToday(s, plan);
  const upcoming = s.part1.items.filter((i) => i.group === "upcoming");
  const [picked, setPicked] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ key: string; over: string | null } | null>(null);
  const stopDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => stopDrag.current?.(), []);

  const all = [...list, ...upcoming];
  // R8a: a running "Làm thêm" run counts as running; its done task opens as that run.
  const running = all.find((i) => i.state === "running") ?? runningItems(s)[0] ?? null;
  const chosen = all.find((i) => i.key === picked) ?? running ?? suggested ?? list.find((i) => i.state !== "done") ?? null;
  const current = chosen ? (extraRunView(chosen) ?? chosen) : null;

  function save(keys: string[]) {
    // Keep what the plan already had that this list does not show (e.g. upcoming picks).
    const kept = (view.plan ?? []).filter((k) => !keys.includes(k));
    const next = [...keys, ...kept];
    setDraft({ base: view.plan, keys: next });
    void onSavePlan(next).then((ok) => {
      if (!ok) setDraft(null);
    });
  }

  function move(key: string, by: -1 | 1) {
    const keys = list.map((i) => i.key);
    const at = keys.indexOf(key);
    const to = at + by;
    if (at < 0 || to < 0 || to >= keys.length) return;
    [keys[at], keys[to]] = [keys[to] as string, keys[at] as string];
    save(keys);
  }

  function pick(key: string) {
    setPicked(key);
    // Below lg the work panel sits under the list: bring it into view.
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.requestAnimationFrame(() => document.getElementById("ht-work")?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" }));
  }

  /**
   * Drag ⋮⋮ with pointer events (mouse, touch and pen; HTML5 drag does not work on iPad). The
   * grip has touch-action: none, so the page does not scroll while a finger drags.
   */
  function startDrag(e: React.PointerEvent<HTMLElement>, key: string) {
    if (busy || !e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety: window listeners still follow the pointer */
    }
    stopDrag.current?.();
    const keys = list.map((i) => i.key);
    const done = new Set(list.filter((i) => i.state === "done").map((i) => i.key));
    const pointer = e.pointerId;
    const rowAt = (x: number, y: number): string | null => {
      const k = document.elementFromPoint(x, y)?.closest<HTMLElement>("li[data-key]")?.dataset.key ?? null;
      return k && keys.includes(k) ? k : null;
    };
    setDrag({ key, over: null });

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointer) return;
      const k = rowAt(ev.clientX, ev.clientY);
      const over = k && k !== key && !done.has(k) ? k : null;
      setDrag((d) => (d && d.over === over ? d : { key, over }));
    };
    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
      stopDrag.current = null;
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointer) return;
      stop();
      setDrag(null);
      if (ev.type !== "pointerup") return;
      const to = rowAt(ev.clientX, ev.clientY);
      const next = to ? dropOrder(keys, done, key, to) : null;
      if (next) save(next);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      stop();
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);
    stopDrag.current = stop;
  }

  return (
    <div className={focus ? "mx-auto flex w-full max-w-[640px] flex-col" : "grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start"}>
      {!focus && (
        <section aria-labelledby="ht-list" className="flex min-w-0 flex-col gap-3 rounded-[20px] border border-ink/10 bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <h3 id="ht-list" className="text-[19px] font-bold">
              Thứ tự hôm nay
            </h3>
            <span className="flex flex-col items-end text-right">
              <span className="text-[13px] font-semibold text-ink/75">còn {leftCount(s)} việc</span>
              <span className="text-xs text-ink/60">
                Bài tập {s.part1.done}/{s.part1.total} · Kỹ năng {s.part2.done}/{s.part2.total}
              </span>
            </span>
          </div>
          <p className="text-[13px] text-ink/70">Kéo ⋮⋮ hoặc bấm ↑ ↓ để xếp. Kỹ năng làm xen kẽ lúc nào cũng được. Thứ tự chỉ để con dễ làm, không đổi giờ khóa/mở máy.</p>
          {list.length === 0 ? (
            <p className="text-sm text-ink/70">Hôm nay không có việc nào.</p>
          ) : (
            <ol aria-labelledby="ht-list" className={`flex flex-col gap-2 ${drag ? "select-none" : ""}`}>
              {list.map((item, n) => {
                const done = item.state === "done";
                const selected = current?.key === item.key;
                const over = drag?.over === item.key;
                return (
                  <li
                    key={item.key}
                    data-key={item.key}
                    aria-label={item.title}
                    className={`grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-[14px] border-2 px-2 py-1.5 ${done ? "opacity-60" : ""}`}
                    style={{
                      borderColor: selected || over ? color : "transparent",
                      borderStyle: over ? "dashed" : "solid",
                      background: selected ? soft(color) : SOFT_ROW,
                      opacity: drag?.key === item.key ? 0.4 : undefined,
                    }}
                  >
                    <span
                      aria-hidden
                      data-grip
                      onPointerDown={done ? undefined : (e) => startDrag(e, item.key)}
                      className={`flex touch-none items-center justify-center self-stretch text-center font-extrabold tracking-[-2px] text-ink/50 select-none [-webkit-touch-callout:none] ${done ? "invisible" : busy ? "cursor-default" : drag ? "cursor-grabbing" : "cursor-grab"}`}
                    >
                      ⋮⋮
                    </span>
                    <button type="button" onClick={() => pick(item.key)} aria-pressed={selected} className="flex min-h-[52px] min-w-0 flex-col items-start gap-0.5 rounded-xl p-1 text-left">
                      <span className="rounded-full px-2 py-px text-[11px] font-bold text-white" style={{ background: tagColor(item, color) }}>
                        {tagLabel(item)}
                      </span>
                      <b className="text-base break-words">
                        {item.title}
                        {item.state === "running" ? " · đang làm" : item.extra ? " · đang làm thêm" : ""}
                      </b>
                      {rowSub(item, ctx) && <span className="text-[13px] text-ink/70">{rowSub(item, ctx)}</span>}
                    </button>
                    {done ? (
                      <span className="flex flex-col items-end gap-0.5 px-1 text-right">
                        <span className="text-sm font-bold whitespace-nowrap text-[#2F6E45]">{item.early ? "✓ Xong · ★ sớm" : "✓ Xong"}</span>
                        {item.runId && ctx.reviewed.has(item.runId) && <span className="text-xs font-semibold text-accent">Bố mẹ đã xem ✓</span>}
                      </span>
                    ) : (
                      <span className="flex flex-col gap-1">
                        <button
                          type="button"
                          aria-label={`Đưa “${item.title}” lên`}
                          disabled={busy || n === 0}
                          onClick={() => move(item.key, -1)}
                          className="size-11 rounded-lg border-[1.5px] border-[#D3D8D0] bg-white font-extrabold disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={`Đưa “${item.title}” xuống`}
                          disabled={busy || n === list.length - 1}
                          onClick={() => move(item.key, 1)}
                          className="size-11 rounded-lg border-[1.5px] border-[#D3D8D0] bg-white font-extrabold disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          <div className="mt-2 flex flex-col gap-0.5">
            <h4 className="text-base font-bold">Làm trước ★ — bài sắp tới</h4>
            {upcoming.length > 0 && (
              <span className="text-[13px] font-semibold" style={{ color: s.part1.pick.done < s.part1.pick.needed ? color : "#4A4F4C" }}>
                {upcomingHint(s)}
              </span>
            )}
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-ink/70">Chưa có bài nào sắp tới.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((item) => (
                <TaskRow key={item.key} item={item} ctx={ctx} locked={paused} />
              ))}
            </ul>
          )}
        </section>
      )}

      <section id="ht-work" aria-label="Khung làm bài" className="flex min-w-0 scroll-mt-4 flex-col gap-3 rounded-[20px] border border-ink/10 bg-white p-[18px] lg:sticky lg:top-4">
        <WorkPanel item={current} ctx={ctx} />
      </section>
    </div>
  );
}

const EYEBROW = "text-xs font-bold tracking-[0.07em] uppercase";

/** The work panel (artifact workPanel): what the child works on, a big timer, the buttons. */
function WorkPanel({ item, ctx }: { item: TaskView | null; ctx: TaskCtx }) {
  if (!item) {
    return (
      <>
        <h3 className="text-[19px] font-bold">Xong hết việc hôm nay rồi!</h3>
        <p className="text-sm text-ink/70">Xem giờ tự do ở thẻ phía trên.</p>
      </>
    );
  }
  if (item.state === "done") {
    return (
      <>
        <span className={EYEBROW} style={{ color: ctx.color }}>
          {tagLabel(item)}
        </span>
        <h3 className="text-[23px] leading-tight font-bold">{item.title} ✓</h3>
        <p className="text-sm text-ink/70">Đã xong. Chọn việc khác trong danh sách.</p>
        {item.source === "template" && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-ink/80">{doneLine(item, ctx.nowMs)}</span>
            <LamThem item={item} ctx={ctx} />
          </div>
        )}
      </>
    );
  }
  const files = ctx.files(item);
  const sub = [whereLine(item) || item.note, dueText(item, ctx.today)].filter(Boolean).join(" · ");
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className={EYEBROW} style={{ color: ctx.color }}>
          {isExtraRun(item) ? "Đang làm thêm" : item.state === "running" ? "Đang làm" : "Việc tiếp theo"} · {tagLabel(item)}
        </span>
        <h3 className="text-[26px] leading-tight font-bold break-words">{item.title}</h3>
        {sub && <p className="text-[15px] text-ink/75">{sub}</p>}
      </div>
      <StudyTimer item={item} ctx={ctx} />
      {isWaiting(item, ctx) && <p className="text-sm font-semibold text-ink/80">Làm xong “{ctx.runningTimed?.title}” rồi bắt đầu việc này.</p>}
      <TaskActions item={item} ctx={ctx} />
      {(item.deepLink || files.length > 0) && (
        <div className="flex flex-wrap items-start gap-2">
          {item.deepLink && (
            <a href={item.deepLink} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#ECEEE8] px-3 text-sm font-semibold text-ink no-underline">
              Mở {item.appLabel ?? "app"} ↗
            </a>
          )}
          <FilesFold files={files} />
        </div>
      )}
    </>
  );
}

/**
 * Big timer of the work panel; ctx.nowMs carries the server offset (never the laptop alone).
 * R7a: minutes only ("còn 12 phút", "đã làm 25 phút"), never a ticking seconds clock.
 */
function StudyTimer({ item, ctx }: { item: TaskView; ctx: TaskCtx }) {
  const timed = !item.requiresProof && item.minMinutes > 0;
  const ms = timerMs(item, ctx.nowMs);
  const ready = timed && item.state === "running" && ms === 0;
  const label = studyTimerLabel(item, ctx.nowMs);
  return (
    <div className="flex flex-col gap-1.5">
      <div role="timer" aria-live="off" className={`leading-tight font-extrabold text-balance ${label.length > 14 ? "text-[28px] sm:text-[34px]" : "text-[44px]"}`} style={{ color: ctx.color }}>
        {label}
      </div>
      <p className="text-[13px] text-ink/70">
        {item.requiresProof
          ? "Bài trên lớp không có thời gian tối thiểu. Làm xong trong vở thì chụp ảnh nộp."
          : ready
            ? `Đủ ${item.minMinutes} phút rồi ✓ — làm xong thì bấm Xong.`
            : timed
              ? `Ít nhất ${item.minMinutes} phút. Nút Xong mở khi đủ giờ (giờ máy chủ).`
              : isExtraRun(item)
                ? "Không bắt buộc — làm bao lâu cũng được."
                : "Không giới hạn thời gian. Làm xong thì bấm Xong."}
      </p>
    </div>
  );
}
