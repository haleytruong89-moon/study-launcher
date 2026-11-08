"use client";

import Link from "next/link";
import type { Avatar } from "@/lib/avatar";
import type { AvatarPics } from "@/lib/avatarPics";
import { QUADS, QUAD_COLORS, QUAD_KEYS, type Voice } from "@/lib/binhYen/catalog";
import type { DayState } from "@/lib/dayState";
import type { TodayView } from "@/lib/today/service";
import { dayLabel, dayMonth, weekSummary } from "@/lib/today/view";
import type { WeekDaysView, WeekFeel } from "@/lib/today/weekDays";
import { QuadMark } from "../quad-icon";
import { WeekStrip } from "./today-parts";

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
          {today ? `Hôm nay con đã ghé Góc bình yên${today.label ? `: ${today.label}` : ""}. Muốn ghé lại thì chạm một vùng.` : "Chạm vào vùng giống con nhất — trước khi học, nếu con muốn."}
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

/** How a feeling is drawn for this child (R6a): An's regions, Nguyên's own faces. */
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
