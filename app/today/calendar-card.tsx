"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { addDays } from "@/lib/time";
import {
  CALENDAR_MONTHS_AHEAD,
  dayAria,
  dayTypeLabel,
  emptyDay,
  firstRange,
  monthGrid,
  monthTitle,
  monthViewRange,
  weekDates,
  type CalendarDay,
  type CalendarView,
} from "@/lib/today/calendar";
import { dayMonth } from "@/lib/today/view";
import { readCalendarMode, subscribeStorage, writeCalendarMode, type CalendarMode } from "./today-storage";

/**
 * "Lịch của con" step 1 (parent decision 14/11/2026): READ ONLY, under the work panel of Góc
 * học tập. Tuần (Mon–Sun) or Tháng (Monday-first grid, this month … +2). Shows homework due,
 * exam / holiday / sick days and the tasks scheduled that weekday. Never a ✓, a done count, a
 * percentage or a chain: past days are only muted. Data: GET /api/calendar (child session, RLS).
 */

const DOT = {
  homework: "#3D6DB5",
  exam: "#D9731E",
  neutral: "#9AA19C",
  skill: "#3C8C5F",
} as const;

const WEEKDAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;
/** Re-read at most every 5 minutes (a parent may add homework while the child works). */
const REFRESH_MS = 5 * 60_000;
const soft = (color: string) => `color-mix(in srgb, ${color} 12%, white)`;

function Dot({ color, label }: { color: string; label?: string }) {
  return <span aria-hidden={label ? undefined : true} aria-label={label} className="inline-block size-2 shrink-0 rounded-full" style={{ background: color }} />;
}

const typeDot = (d: CalendarDay) => (d.dayType === "exam" ? DOT.exam : DOT.neutral);

/** The short lines of one week column (dot + truncated text). */
function weekLines(d: CalendarDay): { key: string; color: string; text: string }[] {
  const label = dayTypeLabel(d.dayType);
  return [
    ...(label ? [{ key: "type", color: typeDot(d), text: label }] : []),
    ...d.homework.map((h) => ({ key: `h:${h.id}`, color: DOT.homework, text: h.title })),
    ...d.skills.map((s) => ({ key: `s:${s.id}`, color: DOT.skill, text: s.title })),
  ];
}

const MAX_WEEK_LINES = 3;

export function CalendarCard({
  today,
  color,
  runningKey,
  nowMs,
}: {
  today: string;
  color: string;
  /** Key of the timed task that is running (the card folds to one line), else null. */
  runningKey: string | null;
  nowMs: number;
}) {
  const stored = useSyncExternalStore(subscribeStorage, readCalendarMode, () => null);
  const [picked, setPicked] = useState<CalendarMode | null>(null);
  const mode: CalendarMode = picked ?? stored ?? "week";
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  // While a timed task runs the card is one line; the child may open it (until the task ends).
  const [openFor, setOpenFor] = useState<string | null>(null);
  const running = runningKey !== null;
  const collapsed = running && openFor !== runningKey;

  const [days, setDays] = useState<Record<string, CalendarDay>>({});
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  const month = monthViewRange(today, monthOffset);
  const range = mode === "week" || monthOffset === 0 ? firstRange(today) : { from: month.from, to: month.to };
  const tick = Math.floor(nowMs / REFRESH_MS);

  useEffect(() => {
    if (collapsed) return;
    let alive = true;
    fetch(`/api/calendar?from=${range.from}&to=${range.to}`, { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<CalendarView>) : Promise.reject(new Error(String(res.status)))))
      .then((v) => {
        if (!alive) return;
        setDays((prev) => {
          const next = { ...prev };
          for (const d of v.days) next[d.date] = d;
          return next;
        });
        setState("ok");
      })
      .catch(() => {
        if (alive) setState((s) => (s === "ok" ? s : "error"));
      });
    return () => {
      alive = false;
    };
  }, [range.from, range.to, tick, collapsed]);

  const dayOf = (date: string) => days[date] ?? emptyDay(date);

  function chooseMode(m: CalendarMode) {
    setPicked(m);
    writeCalendarMode(m);
    setSelected(null);
  }

  /** Arrow keys move between the day buttons (±1 day; ±7 in the month grid). */
  function onGridKey(e: React.KeyboardEvent<HTMLElement>) {
    const date = (e.target as HTMLElement).closest<HTMLElement>("button[data-date]")?.dataset.date;
    if (!date) return;
    const by = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: mode === "month" ? -7 : 0, ArrowDown: mode === "month" ? 7 : 0 }[e.key as string];
    if (!by) return;
    const next = e.currentTarget.querySelector<HTMLElement>(`button[data-date="${addDays(date, by)}"]`);
    if (next) {
      e.preventDefault();
      next.focus();
    }
  }

  if (collapsed) {
    return (
      <section aria-label="Lịch của con" className="rounded-[20px] border border-ink/10 bg-white">
        <button
          type="button"
          aria-expanded={false}
          onClick={() => setOpenFor(runningKey)}
          className="flex min-h-11 w-full items-center justify-between rounded-[20px] px-[18px] py-2 text-left text-[15px] font-bold"
        >
          <span>Lịch của con ›</span>
          <span className="text-xs font-semibold text-ink/60">Đang làm bài — bấm để xem</span>
        </button>
      </section>
    );
  }

  const toggleBtn = (m: CalendarMode, label: string) => (
    <button
      type="button"
      aria-pressed={mode === m}
      onClick={() => chooseMode(m)}
      className="min-h-11 min-w-[64px] rounded-lg px-3 text-sm font-bold motion-safe:transition-colors"
      style={mode === m ? { background: color, color: "white" } : { color: "#1C1F1D" }}
    >
      {label}
    </button>
  );

  return (
    <section aria-labelledby="lich-title" className="flex min-w-0 flex-col gap-3 rounded-[20px] border border-ink/10 bg-white p-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="lich-title" className="text-[19px] font-bold">
          Lịch của con
        </h3>
        <div className="flex items-center gap-2">
          {running && (
            <button type="button" aria-expanded onClick={() => setOpenFor(null)} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-ink/70">
              Thu gọn
            </button>
          )}
          <div role="group" aria-label="Xem theo" className="flex rounded-xl bg-[#ECEEE8] p-0.5">
            {toggleBtn("week", "Tuần")}
            {toggleBtn("month", "Tháng")}
          </div>
        </div>
      </div>

      {mode === "week" ? (
        <div role="group" aria-label="Tuần này" onKeyDown={onGridKey} className="grid grid-cols-7 gap-1">
          {weekDates(today).map((date, n) => {
            const d = dayOf(date);
            const lines = weekLines(d);
            const isToday = date === today;
            const past = date < today;
            return (
              <button
                key={date}
                type="button"
                data-date={date}
                aria-label={dayAria(d, today)}
                aria-pressed={selected === date}
                onClick={() => setSelected(selected === date ? null : date)}
                className={`flex min-h-[112px] min-w-0 flex-col items-stretch gap-1 rounded-xl border-2 px-1 pt-1 pb-1.5 text-left ${past ? "opacity-55" : ""}`}
                style={{
                  borderColor: isToday ? color : selected === date ? "#9AA19C" : "transparent",
                  background: isToday ? soft(color) : selected === date ? "#ECEEE8" : "#F4F5F0",
                }}
              >
                <span aria-hidden className="text-center text-[11px] leading-tight font-bold" style={isToday ? { color } : { color: "#4A4F4C" }}>
                  {isToday ? "Nay" : WEEKDAY_SHORT[n]}
                </span>
                <span aria-hidden className="text-center text-[15px] leading-tight font-extrabold" style={isToday ? { color } : undefined}>
                  {Number(date.slice(8, 10))}
                </span>
                <span aria-hidden className="flex min-w-0 flex-col gap-0.5">
                  {lines.slice(0, MAX_WEEK_LINES).map((l) => (
                    <span key={l.key} className="flex min-h-[14px] min-w-0 items-center justify-center gap-1 text-[11px] leading-tight sm:justify-start">
                      <Dot color={l.color} />
                      {/* Phones: dots only (the column is too narrow); the full list opens below on tap. */}
                      <span className="hidden truncate sm:inline">{l.text}</span>
                    </span>
                  ))}
                  {lines.length > MAX_WEEK_LINES && <span className="text-center text-[11px] leading-tight font-semibold text-ink/60 sm:pl-3 sm:text-left">+{lines.length - MAX_WEEK_LINES}</span>}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Tháng trước"
              disabled={monthOffset <= 0}
              onClick={() => {
                setMonthOffset((o) => Math.max(0, o - 1));
                setSelected(null);
              }}
              className="size-11 rounded-lg border-[1.5px] border-[#D3D8D0] bg-white font-extrabold disabled:opacity-30"
            >
              ‹
            </button>
            <span className="text-[15px] font-bold" aria-live="polite">
              {monthTitle(month.month)}
            </span>
            <button
              type="button"
              aria-label="Tháng sau"
              disabled={monthOffset >= CALENDAR_MONTHS_AHEAD}
              onClick={() => {
                setMonthOffset((o) => Math.min(CALENDAR_MONTHS_AHEAD, o + 1));
                setSelected(null);
              }}
              className="size-11 rounded-lg border-[1.5px] border-[#D3D8D0] bg-white font-extrabold disabled:opacity-30"
            >
              ›
            </button>
          </div>
          <div role="group" aria-label={monthTitle(month.month)} onKeyDown={onGridKey} className="grid grid-cols-7 gap-1">
            {WEEKDAY_SHORT.map((w) => (
              <span key={w} aria-hidden className="text-center text-[11px] font-bold text-ink/60">
                {w}
              </span>
            ))}
            {monthGrid(month.month)
              .flat()
              .map((date, n) => {
                if (date === null) return <span key={`x${n}`} aria-hidden />;
                const d = dayOf(date);
                const isToday = date === today;
                const past = date < today;
                return (
                  <button
                    key={date}
                    type="button"
                    data-date={date}
                    aria-label={dayAria(d, today)}
                    aria-pressed={selected === date}
                    onClick={() => setSelected(selected === date ? null : date)}
                    className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border-2 ${past ? "opacity-55" : ""}`}
                    style={{
                      borderColor: isToday ? color : selected === date ? "#9AA19C" : "transparent",
                      background: isToday ? soft(color) : selected === date ? "#ECEEE8" : "transparent",
                    }}
                  >
                    <span aria-hidden className="text-sm leading-none font-bold" style={isToday ? { color } : undefined}>
                      {Number(date.slice(8, 10))}
                    </span>
                    <span aria-hidden className="flex h-2 items-center gap-0.5">
                      {d.homework.length > 0 && <Dot color={DOT.homework} />}
                      {d.dayType === "exam" && <Dot color={DOT.exam} />}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {state === "loading" && <p className="text-[13px] text-ink/60">Đang tải lịch…</p>}
      {state === "error" && <p className="text-[13px] text-ink/70">Chưa tải được lịch, thử lại sau.</p>}

      {selected && <DayDetail d={dayOf(selected)} today={today} onClose={() => setSelected(null)} />}

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink/70">
        <span className="inline-flex items-center gap-1">
          <Dot color={DOT.homework} /> Hạn nộp bài
        </span>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <Dot color={DOT.exam} /> Kiểm tra
        </span>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <Dot color={DOT.skill} /> Kỹ năng theo lịch
        </span>
      </p>
    </section>
  );
}

/** Every item of one day, untruncated (same panel for Tuần and Tháng). */
function DayDetail({ d, today, onClose }: { d: CalendarDay; today: string; onClose: () => void }) {
  const label = dayTypeLabel(d.dayType);
  const empty = !label && d.homework.length === 0 && d.skills.length === 0;
  const title = `${dayMonth(d.date)}${d.date === today ? " · Hôm nay" : ""}`;
  return (
    <div role="region" aria-label={`Việc ${dayMonth(d.date)}`} className="flex flex-col gap-2 rounded-[14px] bg-[#F4F5F0] p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[15px] font-bold">{title}</h4>
        <button type="button" onClick={onClose} aria-label="Đóng danh sách ngày" className="size-11 rounded-lg text-lg font-bold text-ink/70">
          ✕
        </button>
      </div>
      {empty ? (
        <p className="text-sm text-ink/70">Không có việc nào theo lịch.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {label && (
            <li className="flex items-center gap-2 text-sm font-semibold">
              <Dot color={typeDot(d)} />
              {label}
            </li>
          )}
          {d.homework.map((h) => (
            <li key={h.id} className="flex items-start gap-2 text-sm">
              <span className="pt-1.5">
                <Dot color={DOT.homework} />
              </span>
              <span className="min-w-0 break-words">
                <b>Hạn nộp: {h.title}</b>
                {h.note && <span className="block text-[13px] text-ink/70">{h.note}</span>}
              </span>
            </li>
          ))}
          {d.skills.map((s) => (
            <li key={s.id} className="flex items-start gap-2 text-sm">
              <span className="pt-1.5">
                <Dot color={DOT.skill} />
              </span>
              <span className="min-w-0 break-words">
                {s.title} <span className="text-[13px] text-ink/60">· {s.part === "extra" ? "Bài bổ sung" : "Kỹ năng"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
