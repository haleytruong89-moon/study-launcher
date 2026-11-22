"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { addDays, weekStart } from "@/lib/time";
import {
  CALENDAR_MONTHS_AHEAD,
  calendarWeekStart,
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
import { Shirt } from "./shirt";

/**
 * "Lịch của con" step 1 (parent decision 14/11/2026): READ ONLY, in Góc học tập. Tuần (Mon–Sun)
 * or Tháng (Monday-first grid, this month … +2). Never a ✓, a done count, a percentage or a
 * chain: past days are only muted. Data: GET /api/calendar (child session, RLS).
 *
 * 22/11/2026 (parent): two forms. `compact` in Góc học tập's right column — this week as 7 small
 * cells (due homework, special days, extra classes) and "Xem cả tuần ›"; `full` on Hôm nay — a WIDE
 * week table (+ Tháng). In the wide table each day shows homework due,
 * exam / holiday / sick days, the school lessons (Sáng / Chiều) with the uniform, and the extra
 * classes with their time. The daily skills are no longer in the week table (they are in "Thứ tự
 * hôm nay"; a tapped day still lists them). On Sunday the table opens on NEXT week; ‹ › move
 * one week (last week … 4 weeks ahead).
 */

const DOT = {
  homework: "#3D6DB5",
  exam: "#D9731E",
  neutral: "#9AA19C",
  skill: "#3C8C5F",
  extra: "#8A4FA8",
  school: "#2B5D4F",
} as const;

const WEEKDAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;
/** Re-read at most every 5 minutes (a parent may add homework while the child works). */
const REFRESH_MS = 5 * 60_000;
const soft = (color: string) => `color-mix(in srgb, ${color} 12%, white)`;

function Dot({ color, label }: { color: string; label?: string }) {
  return <span aria-hidden={label ? undefined : true} aria-label={label} className="inline-block size-2 shrink-0 rounded-full" style={{ background: color }} />;
}

const typeDot = (d: CalendarDay) => (d.dayType === "exam" ? DOT.exam : DOT.neutral);

/** The week table moves from last week to 4 weeks ahead of the week it opens on. */
const WEEK_BACK = -1;
const WEEK_AHEAD = 4;
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export function CalendarCard({
  today,
  color,
  runningKey,
  nowMs,
  variant = "full",
  onOpenFull,
}: {
  today: string;
  color: string;
  /** Key of the timed task that is running (the card folds to one line), else null. */
  runningKey: string | null;
  nowMs: number;
  /** 22/11/2026: "compact" in Góc học tập, "full" (the wide table) on Hôm nay. */
  variant?: "full" | "compact";
  /** Compact only: opens the full table on Hôm nay ("Xem cả tuần ›"). */
  onOpenFull?: () => void;
}) {
  const compact = variant === "compact";
  const stored = useSyncExternalStore(subscribeStorage, readCalendarMode, () => null);
  const [picked, setPicked] = useState<CalendarMode | null>(null);
  const mode: CalendarMode = compact ? "week" : (picked ?? stored ?? "week");
  const [monthOffset, setMonthOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  // While a timed task runs the card is one line; the child may open it (until the task ends).
  const [openFor, setOpenFor] = useState<string | null>(null);
  const running = runningKey !== null;
  const collapsed = running && openFor !== runningKey;

  const [days, setDays] = useState<Record<string, CalendarDay>>({});
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  const month = monthViewRange(today, monthOffset);
  const monday = addDays(calendarWeekStart(today), 7 * weekOffset);
  const week = weekDates(monday);
  const range =
    mode === "week" ? { from: monday, to: addDays(monday, 6) } : monthOffset === 0 ? firstRange(today) : { from: month.from, to: month.to };
  const weekLabel =
    monday === weekStart(today) ? "Tuần này" : monday === addDays(weekStart(today), 7) ? "Tuần tới" : monday < weekStart(today) ? "Tuần trước" : `Tuần ${ddmm(monday)}`;
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
    <section id={compact ? undefined : "lich-cua-con"} aria-labelledby="lich-title" className="flex min-w-0 scroll-mt-4 flex-col gap-3 rounded-[20px] border border-ink/10 bg-white p-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="lich-title" className="text-[19px] font-bold">
          Lịch của con
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {/* 21/11/2026: the child keeps the timetable + extra classes themselves. */}
          <a href="/lich-hoc" className="inline-flex min-h-11 items-center rounded-xl border-[1.5px] px-3 text-sm font-bold" style={{ borderColor: color, color }}>
            Sửa lịch học
          </a>
          {running && (
            <button type="button" aria-expanded onClick={() => setOpenFor(null)} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-ink/70">
              Thu gọn
            </button>
          )}
          {compact ? (
            onOpenFull && (
              <button type="button" onClick={onOpenFull} className="min-h-11 rounded-xl px-3 text-sm font-bold text-white" style={{ background: color }}>
                Xem cả tuần ›
              </button>
            )
          ) : (
            <div role="group" aria-label="Xem theo" className="flex rounded-xl bg-[#ECEEE8] p-0.5">
              {toggleBtn("week", "Tuần")}
              {toggleBtn("month", "Tháng")}
            </div>
          )}
        </div>
      </div>

      {compact ? (
        <div role="group" aria-label={weekLabel} onKeyDown={onGridKey} className="grid grid-cols-7 gap-1">
          {week.map((date, n) => (
            <SmallDay
              key={date}
              d={dayOf(date)}
              weekday={WEEKDAY_SHORT[n] as string}
              today={today}
              color={color}
              selected={selected === date}
              onPick={() => setSelected(selected === date ? null : date)}
            />
          ))}
        </div>
      ) : mode === "week" ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Tuần trước"
              disabled={weekOffset <= WEEK_BACK}
              onClick={() => {
                setWeekOffset((o) => Math.max(WEEK_BACK, o - 1));
                setSelected(null);
              }}
              className="size-11 rounded-lg border-[1.5px] border-[#D3D8D0] bg-white font-extrabold disabled:opacity-30"
            >
              ‹
            </button>
            <span className="text-[15px] font-bold" aria-live="polite">
              {weekLabel} · {ddmm(week[0] as string)}–{ddmm(week[6] as string)}
            </span>
            <button
              type="button"
              aria-label="Tuần sau"
              disabled={weekOffset >= WEEK_AHEAD}
              onClick={() => {
                setWeekOffset((o) => Math.min(WEEK_AHEAD, o + 1));
                setSelected(null);
              }}
              className="size-11 rounded-lg border-[1.5px] border-[#D3D8D0] bg-white font-extrabold disabled:opacity-30"
            >
              ›
            </button>
          </div>
          <div role="group" aria-label={weekLabel} onKeyDown={onGridKey}>
            <WeekGrid days={week.map(dayOf)} today={today} color={color} selected={selected} onPick={(date) => setSelected(selected === date ? null : date)} />
          </div>
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
          <Dot color={DOT.extra} /> Học thêm
        </span>
        {mode === "month" && (
          <>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Dot color={DOT.skill} /> Kỹ năng theo lịch (bấm vào ngày để xem)
            </span>
          </>
        )}
      </p>
    </section>
  );
}

/** Every item of one day, untruncated (same panel for Tuần and Tháng). */
function DayDetail({ d, today, onClose }: { d: CalendarDay; today: string; onClose: () => void }) {
  const label = dayTypeLabel(d.dayType);
  const empty = !label && d.homework.length === 0 && d.skills.length === 0 && d.extras.length === 0 && !d.school;
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
          {d.school && (
            <li className="flex items-start gap-2 text-sm">
              <span className="pt-1.5">
                <Dot color={DOT.school} />
              </span>
              <span className="min-w-0 break-words">
                {d.school.am.length > 0 && (
                  <span className="block">
                    <b>Sáng:</b> {d.school.am.join(", ")}
                  </span>
                )}
                {d.school.pm.length > 0 && (
                  <span className="block">
                    <b>Chiều:</b> {d.school.pm.join(", ")}
                  </span>
                )}
                {d.school.uniform && (
                  <span className="flex items-start gap-1 text-[13px] text-ink/70">
                    <Shirt uniform={d.school.uniform} /> Đồng phục: {d.school.uniform}
                  </span>
                )}
              </span>
            </li>
          )}
          {d.extras.map((x, i) => (
            <li key={`x${i}`} className="flex items-start gap-2 text-sm">
              <span className="pt-1.5">
                <Dot color={DOT.extra} />
              </span>
              <span className="min-w-0 break-words">
                <b>Học thêm {x.subject}</b>{" "}
                <span className="text-[13px] text-ink/60">
                  · {x.start}–{x.end}
                  {x.place ? ` · ${x.place}` : ""}
                </span>
              </span>
            </li>
          ))}
          {d.skills.map((s) => (
            <li key={s.id} className="flex items-start gap-2 text-sm">
              <span className="pt-1.5">
                <Dot color={DOT.skill} />
              </span>
              <span className="min-w-0 break-words">
                {s.title} <span className="text-[13px] text-ink/60">· {s.exam ? "Ôn thi" : s.part === "extra" ? "Bài bổ sung" : "Kỹ năng"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A pale fill + dark text from a subject colour (#RRGGBB), as in Sửa lịch học. */
const tint = (hex: string) => ({ background: `${hex}22`, color: hex });

/**
 * The wide week (22/11/2026, parent: "like the timetable the child edits"): a table with the days
 * as columns (T2 … CN) and the lessons as rows (Sáng 1…5, Chiều …, with the time), coloured as in
 * Sửa lịch học; then rows for extra classes (with the time), homework due / special days, and the
 * uniform (a shirt in its colour). The day headers are the buttons (tap → everything below).
 * Phones scroll it sideways, like the editor.
 */
function WeekGrid({ days, today, color, selected, onPick }: { days: CalendarDay[]; today: string; color: string; selected: string | null; onPick: (date: string) => void }) {
  const slots = new Map<string, { session: "am" | "pm"; n: number; time: string | null }>();
  for (const d of days)
    for (const l of d.school?.lessons ?? []) {
      const key = `${l.session}${l.n}`;
      const had = slots.get(key);
      if (!had) slots.set(key, { session: l.session, n: l.n, time: l.time });
      else if (!had.time && l.time) had.time = l.time;
    }
  const rows = [...slots.values()].sort((a, b) => (a.session === b.session ? a.n - b.n : a.session === "am" ? -1 : 1));
  const anyDue = days.some((d) => d.homework.length > 0 || dayTypeLabel(d.dayType));
  const anyExtra = days.some((d) => d.extras.length > 0);
  const anyUniform = days.some((d) => d.school?.uniform);
  const col = (d: CalendarDay) => ({
    className: d.date < today ? "opacity-55" : "",
    style: d.date === today ? { background: soft(color) } : undefined,
  });
  const lessonAt = (d: CalendarDay, session: "am" | "pm", n: number) => d.school?.lessons?.find((l) => l.session === session && l.n === n) ?? null;
  const rowHead = "w-[86px] pr-1 text-left align-top text-xs font-bold text-ink/70";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th className="w-[86px] text-left text-xs font-semibold text-ink/55">Tiết · giờ</th>
            {days.map((d, i) => {
              const isToday = d.date === today;
              return (
                <th key={d.date} scope="col" className="p-0 align-bottom">
                  <button
                    type="button"
                    data-date={d.date}
                    aria-label={dayAria(d, today)}
                    aria-pressed={selected === d.date}
                    onClick={() => onPick(d.date)}
                    className={`flex min-h-11 w-full flex-col items-center justify-center rounded-xl border-2 px-1 ${d.date < today ? "opacity-55" : ""}`}
                    style={{
                      borderColor: isToday ? color : selected === d.date ? "#9AA19C" : "transparent",
                      background: isToday ? soft(color) : selected === d.date ? "#ECEEE8" : "transparent",
                      color: isToday ? color : undefined,
                    }}
                  >
                    <span className="text-[13px] font-bold">{isToday ? "Hôm nay" : WEEKDAY_SHORT[i]}</span>
                    <span className="text-[12px] font-semibold text-ink/60">{ddmm(d.date)}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {anyDue && (
            <tr>
              <th scope="row" className={rowHead} style={{ color: DOT.homework }}>
                Hạn nộp · kiểm tra
              </th>
              {days.map((d) => {
                const label = dayTypeLabel(d.dayType);
                return (
                  <td key={d.date} className={`rounded-lg align-top ${col(d).className}`} style={col(d).style}>
                    <span className="flex flex-col gap-1">
                      {label && (
                        <span className="self-start rounded-full px-2 py-px text-[11.5px] font-bold text-white" style={{ background: typeDot(d) }}>
                          {label}
                        </span>
                      )}
                      {d.homework.map((h) => (
                        <span key={h.id} className="rounded-lg px-1.5 py-1 text-[12px] leading-tight font-semibold break-words" style={{ background: `${DOT.homework}1A`, color: DOT.homework }}>
                          Nộp: {h.title}
                        </span>
                      ))}
                    </span>
                  </td>
                );
              })}
            </tr>
          )}
          {rows.length === 0 && (
            <tr>
              <td colSpan={days.length + 1} className="rounded-xl bg-[#F4F5F0] p-3 text-center text-sm text-ink/65">
                Chưa có thời khóa biểu. Bấm <b>Sửa lịch học</b> để nhập.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={`${r.session}${r.n}`}>
              <th scope="row" className={rowHead}>
                <span className="block">{`${r.session === "pm" ? "Chiều" : "Sáng"} ${r.n}`}</span>
                {r.time && <span className="block text-[11px] font-normal text-ink/55 tabular-nums">{r.time.replace("-", "–")}</span>}
              </th>
              {days.map((d) => {
                const l = lessonAt(d, r.session, r.n);
                return (
                  <td key={d.date} className={`rounded-lg ${col(d).className}`} style={col(d).style}>
                    {l ? (
                      <span className="flex min-h-10 items-center justify-center rounded-xl px-1 text-center text-[12.5px] leading-tight font-semibold break-words" style={tint(l.color)}>
                        {l.subject}
                      </span>
                    ) : (
                      <span aria-hidden className="block min-h-10 rounded-xl border-[1.5px] border-dashed border-ink/10" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {anyExtra && (
            <tr>
              <th scope="row" className={rowHead} style={{ color: DOT.extra }}>
                Học thêm
              </th>
              {days.map((d) => (
                <td key={d.date} className={`rounded-lg align-top ${col(d).className}`} style={col(d).style}>
                  <span className="flex flex-col gap-1">
                    {d.extras.map((x, i) => (
                      <span key={i} className="rounded-xl px-1.5 py-1 text-center text-[12px] leading-tight font-semibold" style={{ background: "#8A4FA81F", color: "#6E3A8C" }}>
                        <span className="block tabular-nums">
                          {x.start}–{x.end}
                        </span>
                        <span className="block break-words">{x.subject}</span>
                        {x.place && <span className="block text-[11px] font-normal text-ink/60">{x.place}</span>}
                      </span>
                    ))}
                  </span>
                </td>
              ))}
            </tr>
          )}
          {anyUniform && (
            <tr>
              <th scope="row" className={rowHead}>
                Đồng phục
              </th>
              {days.map((d) => (
                <td key={d.date} className={`rounded-lg align-top ${col(d).className}`} style={col(d).style}>
                  {d.school?.uniform && (
                    <span className="flex items-start gap-1 text-[11.5px] leading-snug text-ink/70">
                      <Shirt uniform={d.school.uniform} size={18} />
                      <span className="min-w-0 break-words">{d.school.uniform}</span>
                    </span>
                  )}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** The short lines of one small cell (compact card): special day, homework due, extra classes. */
function smallLines(d: CalendarDay): { key: string; color: string; text: string }[] {
  const label = dayTypeLabel(d.dayType);
  return [
    ...(label ? [{ key: "type", color: typeDot(d), text: label }] : []),
    ...d.homework.map((h) => ({ key: `h:${h.id}`, color: DOT.homework, text: h.title })),
    ...d.extras.map((x, i) => ({ key: `x:${i}`, color: DOT.extra, text: `${x.start} ${x.subject}` })),
  ];
}

const MAX_SMALL_LINES = 3;

/** One day of the compact card (as before 22/11/2026, without the daily skills). */
function SmallDay({ d, weekday, today, color, selected, onPick }: { d: CalendarDay; weekday: string; today: string; color: string; selected: boolean; onPick: () => void }) {
  const lines = smallLines(d);
  const isToday = d.date === today;
  const past = d.date < today;
  return (
    <button
      type="button"
      data-date={d.date}
      aria-label={dayAria(d, today)}
      aria-pressed={selected}
      onClick={onPick}
      className={`flex min-h-[92px] min-w-0 flex-col items-stretch gap-1 rounded-xl border-2 px-1 pt-1 pb-1.5 text-left ${past ? "opacity-55" : ""}`}
      style={{
        borderColor: isToday ? color : selected ? "#9AA19C" : "transparent",
        background: isToday ? soft(color) : selected ? "#ECEEE8" : "#F4F5F0",
      }}
    >
      <span aria-hidden className="text-center text-[11px] leading-tight font-bold" style={isToday ? { color } : { color: "#4A4F4C" }}>
        {isToday ? "Nay" : weekday}
      </span>
      <span aria-hidden className="text-center text-[15px] leading-tight font-extrabold" style={isToday ? { color } : undefined}>
        {Number(d.date.slice(8, 10))}
      </span>
      <span aria-hidden className="flex min-w-0 flex-col gap-0.5">
        {lines.slice(0, MAX_SMALL_LINES).map((l) => (
          <span key={l.key} className="flex min-h-[14px] min-w-0 items-center justify-center gap-1 text-[11px] leading-tight sm:justify-start">
            <Dot color={l.color} />
            {/* Phones: dots only (the column is too narrow); the full list opens below on tap. */}
            <span className="hidden truncate sm:inline">{l.text}</span>
          </span>
        ))}
        {lines.length > MAX_SMALL_LINES && <span className="text-center text-[11px] leading-tight font-semibold text-ink/60 sm:pl-3 sm:text-left">+{lines.length - MAX_SMALL_LINES}</span>}
        {lines.length === 0 && d.school && <span className="text-center text-[11px] leading-tight text-ink/55 sm:text-left">Đi học</span>}
      </span>
    </button>
  );
}
