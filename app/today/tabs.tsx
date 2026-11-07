"use client";

import Link from "next/link";
import { useState } from "react";
import type { Avatar } from "@/lib/avatar";
import type { AvatarPics } from "@/lib/avatarPics";
import { QUADS, QUAD_COLORS, QUAD_KEYS, type Voice } from "@/lib/binhYen/catalog";
import type { DayState, TaskView } from "@/lib/dayState";
import type { TodayView } from "@/lib/today/service";
import { clock, dayLabel, dayMonth, upcomingHint, vnTime, weekSummary } from "@/lib/today/view";
import { plannable } from "@/lib/today/week";
import type { WeekDay, WeekDaysView, WeekFeel } from "@/lib/today/weekDays";
import { QuadMark } from "../quad-icon";
import { NextTask, TaskRow, WeekStrip, type TaskCtx } from "./today-parts";

/** How a feeling is drawn for this child (R6a): An's regions, Nguyên's own faces. */
/**
 * R6a (artifact, item I): the invite to Góc bình yên at the top of Hôm nay, with the 4 regions.
 * A tile opens the corner straight at that region's words (/binh-yen?quad=…). Only an invite:
 * it never blocks studying. The feeling of today is shown only to the child.
 */
export function FeelInvite({ voice, feelLook, today }: { voice: Voice; feelLook: FeelLook; today: WeekFeel | null }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col">
        <strong id="by-invite" className="text-lg">
          Hôm nay con thấy thế nào?
        </strong>
        <span className="text-sm text-ink/70">
          {today ? `Hôm nay con đã ghé Góc bình yên: ${today.label}. Muốn ghé lại thì chạm một vùng.` : "Chạm vào vùng giống con nhất — trước khi học, nếu con muốn."}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {QUAD_KEYS.map((q) => {
          const info = QUADS[voice][q];
          return (
            <Link
              key={q}
              href={`/binh-yen?quad=${q}`}
              aria-label={`${info.label}: ${info.sub}`}
              className="flex min-h-16 items-center gap-2 rounded-2xl px-3 py-2 text-ink no-underline transition-transform hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              style={{ background: QUAD_COLORS[q].soft }}
            >
              <QuadMark quad={q} voice={voice} look={feelLook.look} pics={feelLook.pics} size={36} />
              <span className="text-sm font-bold leading-tight">{info.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export interface FeelLook {
  voice: Voice;
  look: Avatar | null;
  pics: AvatarPics;
}

/**
 * R2 tabs of /today (docs/MAN_CHINH_MOI.md §2–3). Display only: every decision (lock, break,
 * free time, what may start) stays with the server; these components just show DayState and
 * the child's own week. The feelings shown here come from /api/week/days (child session only).
 */

// ---------------------------------------------------------------------------
// Feelings of the week (Hôm nay + Tuần của con)
// ---------------------------------------------------------------------------

export function FeelWeek({ week, color, big = false, feelLook }: { week: WeekDaysView; color: string; big?: boolean; feelLook: FeelLook }) {
  return (
    <ol aria-label="Cảm xúc tuần này" className="grid grid-cols-7 gap-1 text-center">
      {week.days.map((d) => {
        const isToday = d.date === week.today;
        const label = d.future ? "Chưa đến" : d.feel ? d.feel.label || "Đã ghé" : "Chưa ghé";
        return (
          <li key={d.date} className="flex min-w-0 flex-col items-center gap-1">
            <span className={`text-xs ${isToday ? "font-bold" : "text-ink/70"}`} style={isToday ? { color } : undefined}>
              {dayLabel(d.date, week.today)}
            </span>
            <span role="img" aria-label={`${dayMonth(d.date)}: ${label}`} title={label} className={`flex items-center justify-center ${d.future ? "opacity-40" : ""}`}>
              {d.feel ? (
                <QuadMark quad={d.feel.quad} voice={feelLook.voice} look={feelLook.look} pics={feelLook.pics} size={big ? 44 : 36} />
              ) : (
                <span className={`rounded-full ${big ? "size-11" : "size-9"}`} style={{ border: "1.5px dashed rgba(28,31,29,0.3)" }} />
              )}
            </span>
            {big && <span className="w-full truncate text-[11px] text-ink/75">{d.feel ? d.feel.label : ""}</span>}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// The four areas of today (Hôm nay)
// ---------------------------------------------------------------------------

function Pillar({ icon, title, line, done, action }: { icon: string; title: string; line: string; done: boolean; action?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-3.5">
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-xl">
          {icon}
        </span>
        <strong className="grow">{title}</strong>
        {done && (
          <span className="rounded-full bg-[#DCEDE0] px-2 py-0.5 text-xs font-bold text-[#24563A]" aria-label="Đã xong">
            ✓
          </span>
        )}
      </div>
      <span className="text-sm text-ink/75">{line}</span>
      {action}
    </li>
  );
}

export function PillarCards({
  s,
  today,
  byEnabled,
  color,
  nowMs,
  freeMinutes,
  onStudy,
}: {
  s: DayState;
  today: WeekDay | null;
  byEnabled: boolean;
  color: string;
  nowMs: number;
  freeMinutes: number;
  onStudy: () => void;
}) {
  const go = (label: string) => (
    <button type="button" onClick={onStudy} className="btn self-start border-[1.5px] bg-white text-sm" style={{ borderColor: color, color }}>
      {label}
    </button>
  );
  const freeLine =
    s.free.startedAt === null
      ? `Xong bài tập và kỹ năng là có ${freeMinutes} phút giờ tự do.`
      : s.free.endsAt && nowMs < new Date(s.free.endsAt).getTime()
        ? `Đang giờ tự do · còn ${clock(new Date(s.free.endsAt).getTime() - nowMs)}`
        : `Đã dùng giờ tự do hôm nay (từ ${vnTime(s.free.startedAt)}).`;
  return (
    <ul aria-label="Bốn mảng hôm nay" className="grid gap-2.5 sm:grid-cols-2">
      {byEnabled && (
        <Pillar
          icon="🌿"
          title="Cảm xúc"
          done={!!today?.feel}
          line={today?.feel ? `Hôm nay con thấy: ${today.feel.label}` : "Con chưa ghé Góc bình yên hôm nay."}
          action={
            <Link href="/binh-yen" className="btn self-start border-[1.5px] bg-white text-sm no-underline" style={{ borderColor: color, color }}>
              Vào Góc bình yên
            </Link>
          }
        />
      )}
      <Pillar
        icon="📚"
        title="Học tập"
        done={s.part1.complete}
        line={s.part1.total === 0 ? "Hôm nay không có bài tập." : `${s.part1.done}/${s.part1.total} việc xong`}
        action={!s.part1.complete ? go("Vào Góc học tập") : undefined}
      />
      <Pillar
        icon="🎯"
        title="Kỹ năng"
        done={s.part2.complete}
        line={s.part2.total === 0 ? "Hôm nay không có kỹ năng." : `${s.part2.done}/${s.part2.total} kỹ năng xong · làm song song với bài tập`}
        action={!s.part2.complete ? go("Làm kỹ năng") : undefined}
      />
      <Pillar icon="🎮" title="Vui chơi" done={s.free.startedAt !== null} line={freeLine} />
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Góc học tập (§3)
// ---------------------------------------------------------------------------

const GROUP_LABEL = (i: TaskView) => (i.source === "homework" ? (i.group === "upcoming" ? "Làm trước" : "Bài trên lớp") : i.part === 1 ? "Bài bổ sung" : "Kỹ năng");

/** Today's tasks in the child's order (the saved plan first, then the rest in the usual order). */
export function orderedToday(s: DayState, plan: string[] | null): TaskView[] {
  const items = plannable(s).filter((i) => i.group !== "upcoming");
  if (!plan) return items;
  const pos = new Map(plan.map((k, n) => [k, n]));
  return [...items].sort((a, b) => (pos.get(a.key) ?? 1e6 + items.indexOf(a)) - (pos.get(b.key) ?? 1e6 + items.indexOf(b)));
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
}) {
  const list = orderedToday(s, view.plan);
  const upcoming = s.part1.items.filter((i) => i.group === "upcoming");
  const [picked, setPicked] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);
  const all = [...list, ...upcoming];
  const running = all.find((i) => i.state === "running") ?? null;
  const current = all.find((i) => i.key === picked) ?? running ?? suggested ?? list.find((i) => i.state !== "done") ?? null;

  function move(key: string, by: -1 | 1) {
    const keys = list.map((i) => i.key);
    const at = keys.indexOf(key);
    const to = at + by;
    if (at < 0 || to < 0 || to >= keys.length) return;
    [keys[at], keys[to]] = [keys[to] as string, keys[at] as string];
    // Keep what the plan already had that this list does not show (e.g. upcoming picks).
    const kept = (view.plan ?? []).filter((k) => !keys.includes(k));
    void onSavePlan([...keys, ...kept]);
  }

  return (
    <div className={`grid gap-5 ${focus ? "" : "lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]"} lg:items-start`}>
      {!focus && (
        <section aria-labelledby="ht-list" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="ht-list" className="text-lg font-bold">
              Thứ tự hôm nay
            </h2>
            <span className="text-[13px] font-semibold text-ink/70">
              Bài tập {s.part1.done}/{s.part1.total} · Kỹ năng {s.part2.done}/{s.part2.total}
            </span>
          </div>
          <p className="text-[13px] text-ink/70">Con xếp thứ tự bằng nút ↑ ↓. Thứ tự chỉ để con dễ làm, không đổi giờ khóa/mở máy.</p>
          {list.length === 0 ? (
            <p className="text-sm text-ink/70">Hôm nay không có việc nào.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {list.map((item, n) => (
                <li key={item.key} className="flex items-stretch gap-1.5">
                  <div className="flex flex-col justify-center gap-1">
                    <button type="button" aria-label={`Đưa “${item.title}” lên`} disabled={busy || n === 0} onClick={() => move(item.key, -1)} className="size-11 rounded-xl border border-ink/15 bg-white text-lg disabled:opacity-30">
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Đưa “${item.title}” xuống`}
                      disabled={busy || n === list.length - 1}
                      onClick={() => move(item.key, 1)}
                      className="size-11 rounded-xl border border-ink/15 bg-white text-lg disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                  <div className="flex min-w-0 grow flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => setPicked(item.key)}
                      aria-pressed={current?.key === item.key}
                      className="inline-flex min-h-11 items-center self-start rounded-full px-3 text-xs font-bold"
                      style={current?.key === item.key ? { background: color, color: "#fff" } : { background: "#EEF0EC", color: "#4A4F4C" }}
                    >
                      {GROUP_LABEL(item)} · {current?.key === item.key ? "đang xem" : "xem chi tiết"}
                    </button>
                    <ul className="contents">
                      <TaskRow item={item} ctx={ctx} locked={paused} />
                    </ul>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-2 flex flex-col gap-0.5">
            <h3 className="text-base font-bold">Làm trước ★ — bài sắp tới</h3>
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

      <section aria-label="Khung làm bài" className="flex flex-col gap-3 rounded-[20px] border-2 bg-white p-4 lg:sticky lg:top-4" style={{ borderColor: color }}>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setFocus(!focus)} aria-pressed={focus} className="btn ml-auto border-[1.5px] bg-white text-sm" style={{ borderColor: color, color }}>
            {focus ? "Hiện danh sách" : "Chỉ hiện bài đang xem"}
          </button>
        </div>
        {current === null ? (
          <p className="text-sm text-ink/70">Xong hết việc hôm nay rồi!</p>
        ) : current.state === "done" ? (
          <div className="flex flex-col gap-1">
            <div className="text-xs font-bold tracking-[0.08em] uppercase" style={{ color }}>
              Con đang xem
            </div>
            <div className="text-[23px] leading-tight font-bold">{current.title}</div>
            <p className="font-semibold" style={{ color }}>
              ✓ Xong rồi
            </p>
          </div>
        ) : (
          <NextTask item={current} ctx={ctx} label={current.state === "running" ? "Con đang làm" : "Con đang xem"} />
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tuần của con (tab 4 until R4/R5 bring the child's world)
// ---------------------------------------------------------------------------

const AREAS: { key: "study" | "skill" | "play"; icon: string; label: string }[] = [
  { key: "study", icon: "📚", label: "Học tập" },
  { key: "skill", icon: "🎯", label: "Kỹ năng" },
  { key: "play", icon: "🎮", label: "Vui chơi" },
];

export function WeekAreas({ week, color, feelLook }: { week: WeekDaysView; color: string; feelLook: FeelLook }) {
  return (
    <table className="w-full table-fixed text-center text-sm">
      <caption className="sr-only">Con đã làm gì mỗi ngày trong tuần</caption>
      <thead>
        <tr>
          <th scope="col" className="w-24 text-left text-xs font-semibold text-ink/70">
            Mảng
          </th>
          {week.days.map((d) => (
            <th key={d.date} scope="col" className="text-xs font-semibold" style={d.date === week.today ? { color } : { color: "#4A4F4C" }}>
              {dayLabel(d.date, week.today)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {week.byEnabled && (
          <tr>
            <th scope="row" className="py-1.5 text-left text-[13px] font-semibold">
              🌿 Cảm xúc
            </th>
            {week.days.map((d) => (
              <td key={d.date} aria-label={d.feel ? `Đã ghé: ${d.feel.label}` : "Chưa ghé"}>
                {d.feel ? (
                  <span className="inline-flex justify-center">
                    <QuadMark quad={d.feel.quad} voice={feelLook.voice} look={feelLook.look} pics={feelLook.pics} size={26} />
                  </span>
                ) : (
                  <span aria-hidden className="text-ink/25">·</span>
                )}
              </td>
            ))}
          </tr>
        )}
        {AREAS.map((a) => (
          <tr key={a.key}>
            <th scope="row" className="py-1.5 text-left text-[13px] font-semibold">
              {a.icon} {a.label}
            </th>
            {week.days.map((d) => (
              <td key={d.date} aria-label={d[a.key] ? "Đã làm" : d.future ? "Chưa đến" : "Chưa"}>
                {d[a.key] ? (
                  <span aria-hidden className="font-bold" style={{ color }}>
                    ✓
                  </span>
                ) : (
                  <span aria-hidden className="text-ink/25">
                    ·
                  </span>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The "Tuần này" card (week strip, ★ sớm, Tin tưởng) — moved here from Hôm nay in R2. */
export function WeekProgress({ s, view, color }: { s: DayState; view: TodayView; color: string }) {
  return (
    <section aria-labelledby="wkh" className="flex flex-col gap-3.5 rounded-2xl border border-ink/10 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="wkh" className="text-lg font-bold">
          7 ngày qua
        </h2>
        <span className="text-[13px] font-semibold text-ink/70">{weekSummary(s.week)}</span>
      </div>
      <WeekStrip week={s.week} today={s.localDate} firstDay={view.firstDay} color={color} />
      {s.earlyThisWeek > 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-[#FBF0D6] px-3 py-2.5 text-sm font-semibold text-[#5E3D00]">
          <span aria-hidden>★</span> Tuần này làm sớm {s.earlyThisWeek} bài
        </p>
      ) : (
        <p className="text-sm text-ink/70">Làm xong bài trước hạn ít nhất 2 ngày để được ★ sớm.</p>
      )}
      <div className="flex flex-col gap-2 border-t border-ink/10 pt-3.5">
        <div className="flex flex-wrap justify-between gap-2">
          <span className="font-bold">{s.trust.mode === "trust" ? "Đang ở chế độ Tin tưởng" : "Tiến tới chế độ Tin tưởng"}</span>
          {s.trust.mode === "lock" && (
            <span className="text-sm font-bold text-accent">
              {s.trust.weeksMet}/{s.trust.weeksNeeded} tuần
            </span>
          )}
        </div>
        {s.trust.mode === "trust" && <span className="text-[13px] text-ink/70">Máy không chặn trang nào — con tự quản giờ học. Việc hôm nay vẫn tính ngày đạt như thường.</span>}
        {s.trust.mode === "lock" && (
          <>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-[#E3E6E0]"
              role="progressbar"
              aria-label="Số tuần đạt"
              aria-valuemin={0}
              aria-valuemax={s.trust.weeksNeeded}
              aria-valuenow={s.trust.weeksMet}
            >
              <div className="h-2.5 rounded-full bg-accent" style={{ width: `${Math.round((s.trust.weeksMet / Math.max(1, s.trust.weeksNeeded)) * 100)}%` }} />
            </div>
            <span className="text-[13px] text-ink/70">
              Đủ {s.trust.weeksNeeded} tuần liên tiếp đạt ≥ {view.rules.trustUpPct}% ngày → bố mẹ cùng con xem chuyển sang Tin tưởng: máy không chặn web, con tự quản giờ học.
            </span>
          </>
        )}
      </div>
    </section>
  );
}
