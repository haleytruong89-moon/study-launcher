"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import type { Avatar } from "@/lib/avatar";
import type { AvatarPics } from "@/lib/avatarPics";
import type { Voice } from "@/lib/binhYen/catalog";
import { SPEED, comicPage, panelLabel, type ComicPage, type Panel } from "@/lib/comic/model";
import { parsePlayPlans, readPlayPlansRaw } from "@/lib/today/playPlan";
import type { WeekDaysView } from "@/lib/today/weekDays";
import { recentDayLabel, type MonthView, type RecentDay, type RecentItem } from "@/lib/world/rules";
import type { Pillar } from "@/lib/world/types";
import { Face, SpeedLines } from "../today/comic";
import { LivingScene } from "../today/world-scene";
import { WorldIcon } from "../world-icon";

/**
 * R7b: Góc bình yên's "Nhìn lại" column. Calm on purpose: no counters that grow, no blinking,
 * a slowed-down scene. Child-only data (the routes answer 403 to a parent).
 * - An (scientist): her world of the month and what grew / who came in the last 7 days, with
 *   the facts she opened and the marks she set on this device.
 * - Nguyên (detective): today's comic page only. Deliberately NO feelings timeline here (a week
 *   of red / blue next to the check-in can feed rumination); `notebook` is R7c's slot.
 */

export interface RecentView {
  /** The server's local date (Asia/Ho_Chi_Minh): "Hôm nay" / "Hôm qua" never use the laptop clock. */
  today: string;
  view: MonthView | null;
  days: RecentDay[];
}

type Load<T> = { state: "loading" } | { state: "error"; text: string } | { state: "ok"; data: T };

const CALM_ERROR = "Chưa tải được phần nhìn lại. Lúc khác con xem nhé.";

function useFetch<T>(url: string, ok: (v: unknown) => v is T): Load<T> {
  const [load, setLoad] = useState<Load<T>>({ state: "loading" });
  useEffect(() => {
    let live = true;
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as unknown;
        if (!live) return;
        if (res.ok && ok(data)) setLoad({ state: "ok", data });
        else setLoad({ state: "error", text: res.status === 503 && data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : CALM_ERROR });
      })
      .catch(() => live && setLoad({ state: "error", text: CALM_ERROR }));
    return () => {
      live = false;
    };
  }, [url, ok]);
  return load;
}

const isRecent = (v: unknown): v is RecentView => !!v && typeof v === "object" && Array.isArray((v as RecentView).days) && typeof (v as RecentView).today === "string";
const isWeek = (v: unknown): v is WeekDaysView => !!v && typeof v === "object" && Array.isArray((v as WeekDaysView).days) && typeof (v as WeekDaysView).today === "string";

/** A quiet placeholder while loading (no pulse: nothing blinks here). */
function Skeleton() {
  return (
    <div role="status" aria-label="Đang tải" className="flex flex-col gap-3">
      <div className="aspect-[16/7] rounded-2xl bg-ink/5" />
      <div className="h-4 w-2/3 rounded bg-ink/5" />
      <div className="h-4 w-1/2 rounded bg-ink/5" />
    </div>
  );
}

export function LookBack({
  voice,
  firstName,
  color,
  look,
  pics,
  notebook,
}: {
  voice: Voice;
  firstName: string;
  color: string;
  look: Avatar;
  pics: AvatarPics;
  /** R7c "Sổ tay thám tử" (detective only). Nothing is rendered when it is not given. */
  notebook?: React.ReactNode;
}) {
  return voice === "scientist" ? <WorldLookBack firstName={firstName} color={color} /> : <ComicLookBack color={color} look={look} pics={pics} notebook={notebook} />;
}

// ---------------------------------------------------------------------------
// An: her world and the last 7 days
// ---------------------------------------------------------------------------

const AREA: Record<Pillar, string> = { feel: "Cảm xúc", study: "Học tập", skill: "Kỹ năng", play: "Vui chơi" };

// The marks An set in the world card ("Con đã làm", "Tối nay dạy cả nhà"), on this device only.
function readSet(name: string): Set<string> {
  try {
    const v = JSON.parse(window.localStorage.getItem(name) ?? "[]") as unknown;
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

/**
 * The scene's own motion, slowed down for this calm column (visitors, swaying, twinkling).
 * Important: the scene classes are unlayered CSS. Under reduced motion globals.css sets
 * `animation: none`, and a duration alone never restarts it.
 */
const SLOW_SCENE =
  "[&_.w-sway]:[animation-duration:10s]! [&_.w-hop]:[animation-duration:9s]! [&_.w-fly]:[animation-duration:14s]! [&_.w-swim]:[animation-duration:22s]! [&_.w-float]:[animation-duration:14s]! [&_.w-twinkle]:[animation-duration:7s]! [&_.w-star]:[animation-duration:7s]!";

function WorldLookBack({ firstName, color }: { firstName: string; color: string }) {
  const load = useFetch("/api/world/recent", isRecent);
  // Read after mount (never during the first render).
  const [marks, setMarks] = useState<{ quests: Set<string>; teach: Set<string> } | null>(null);
  useEffect(() => {
    if (load.state !== "ok") return;
    const id = window.setTimeout(() => setMarks({ quests: readSet("world-quests"), teach: readSet("world-teach") }), 0);
    return () => window.clearTimeout(id);
  }, [load.state]);
  const head = useId();

  if (load.state === "loading") return <Skeleton />;
  if (load.state === "error") return <p className="text-sm text-ink/75">{load.text}</p>;
  const { view, days, today } = load.data;
  // The quest mark is per month: shown once, on the newest row of that thing.
  const questShown = new Set<string>();

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby={head} className="flex flex-col gap-2">
        <h3 id={head} className="text-base font-bold">
          {view ? `${view.world.emoji} ${view.world.name} của ${firstName}` : `🌍 Thế giới của ${firstName}`}
        </h3>
        {view ? (
          // A picture only; the list below says what is in it. Slowed down here (calm column);
          // `isolate` keeps its z-indexed visitors under the fixed tab bar.
          <div aria-hidden className={`isolate ${SLOW_SCENE}`}>
            <LivingScene view={view} compact />
          </div>
        ) : (
          <p className="text-sm text-ink/75">Thế giới tháng này đang chờ con chọn ở Hôm nay.</p>
        )}
      </section>

      <section aria-label="7 ngày qua" className="flex flex-col gap-3">
        <h3 className="text-base font-bold">7 ngày qua</h3>
        {days.length === 0 ? (
          <p className="rounded-xl bg-bg p-3 text-sm text-ink/75">7 ngày qua chưa có gì mọc. Xong một mảng hôm nay là có thứ mới.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {days.map((d) => (
              <li key={d.date} className="flex flex-col gap-1.5">
                <h4 className="text-sm font-bold text-ink/70">{recentDayLabel(d.date, today)}</h4>
                <ul className="flex flex-col gap-1.5">
                  {d.items.map((item) => {
                    const questKey = `${item.month}:${item.key}`;
                    const quest = !!marks?.quests.has(questKey) && !questShown.has(questKey);
                    if (quest) questShown.add(questKey);
                    return <RecentRow key={`${item.kind}:${item.key}`} item={item} quest={quest} taught={!!marks?.teach.has(`${d.date}:${item.key}`)} />;
                  })}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>

      {view && (
        <Link href="/today?tab=tuan" className="inline-flex min-h-11 items-center self-start text-sm font-semibold underline" style={{ color }}>
          Xem cả {view.world.name} →
        </Link>
      )}
    </div>
  );
}

function RecentRow({ item, quest, taught }: { item: RecentItem; quest: boolean; taught: boolean }) {
  return (
    <li className="flex flex-col gap-1 rounded-xl bg-bg px-3 py-2">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white">
          <WorldIcon icon={item.icon} size={28} />
        </span>
        <span className="min-w-0 grow text-sm">
          {item.kind === "thing" ? (
            <>
              <b>{item.name}</b> {item.isNew ? "mọc" : "mọc thêm"}
            </>
          ) : (
            <>
              <b>{item.name}</b> ghé {item.world}
            </>
          )}
        </span>
        {item.pillar && <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink/70">{AREA[item.pillar]}</span>}
      </div>
      {item.fact && (
        <details className="group/fact pl-[46px] text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-ink/80 marker:content-none">
            <span aria-hidden className="mr-1 inline-block transition-transform group-open/fact:rotate-90 motion-reduce:transition-none">
              ›
            </span>
            Điều con biết thêm
          </summary>
          <p className="pb-1 text-ink/85">{item.fact}</p>
        </details>
      )}
      {(quest || taught) && (
        <p className="flex flex-wrap gap-x-3 pl-[46px] text-xs font-semibold text-[#2F6E45]">
          {quest && <span>✓ Con đã làm nhiệm vụ</span>}
          {taught && <span className="text-[#5E3D00]">🍽️ Đã dạy cả nhà</span>}
        </p>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Nguyên: today's comic page (compact, read-only)
// ---------------------------------------------------------------------------

function ComicLookBack({ color, look, pics, notebook }: { color: string; look: Avatar; pics: AvatarPics; notebook?: React.ReactNode }) {
  const load = useFetch("/api/week/days", isWeek);
  // The free-time plan is kept in this browser: read after the week arrives (after mount).
  const [plans, setPlans] = useState<Record<string, string>>({});
  useEffect(() => {
    if (load.state !== "ok") return;
    const id = window.setTimeout(() => setPlans(parsePlayPlans(readPlayPlansRaw())), 0);
    return () => window.clearTimeout(id);
  }, [load.state]);
  const head = useId();

  let page: ComicPage | null = null;
  if (load.state === "ok") {
    const week = load.data;
    const i = week.days.findIndex((d) => d.date === week.today);
    const day = week.days[i];
    // No free-time minutes here (no extra read): a finished free time says "Giờ tự do ✓".
    if (day) page = comicPage(day, i, { today: week.today, byEnabled: week.byEnabled, skillTitleToday: null, freeMinutes: 0, playPlan: (d) => plans[d] ?? null });
    if (page) page = { ...page, panels: page.panels.map((p) => (p.kind === "play" && !plans[page!.date] ? { ...p, box: "Giờ tự do ✓" } : p)) };
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby={head} className="flex flex-col gap-2">
        <h3 id={head} className="text-base font-bold">
          Trang truyện hôm nay
        </h3>
        {load.state === "loading" && <Skeleton />}
        {load.state === "error" && <p className="text-sm text-ink/75">{load.text}</p>}
        {load.state === "ok" && !page && <p className="text-sm text-ink/75">Trang hôm nay chưa mở. Lúc khác con xem nhé.</p>}
        {page && <MiniPage page={page} look={look} pics={pics} />}
        <Link href="/today?tab=tuan" className="inline-flex min-h-11 items-center self-start text-sm font-semibold underline" style={{ color }}>
          Xem Tập của tuần →
        </Link>
      </section>
      {notebook ?? null}
    </div>
  );
}

const CAP = "absolute top-1 left-1 z-10 bg-ink px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-white";
const BOX = "absolute inset-x-1 bottom-1 z-10 truncate border-2 border-ink bg-white px-1 py-0.5 text-center text-[11px] leading-snug";

/** The day's page made small (artifact `.mpage`): A across, then B | C, then D | E. No sound effects here. */
function MiniPage({ page, look, pics }: { page: ComicPage; look: Avatar; pics: AvatarPics }) {
  return (
    <article aria-label={`Trang ${page.label}`} className="isolate grid grid-cols-2 gap-1.5 border-4 border-ink bg-[#FFFDF8] p-1.5 shadow-[4px_4px_0_rgba(28,31,29,.15)]">
      {page.panels.map((p) => (
        <MiniPanel key={p.id} p={p} look={look} pics={pics} />
      ))}
    </article>
  );
}

function MiniPanel({ p, look, pics }: { p: Panel; look: Avatar; pics: AvatarPics }) {
  const a = p.id === "A";
  const base = `relative flex flex-col items-center justify-center gap-1 overflow-hidden border-[2.5px] px-1.5 pt-6 pb-8 ${a ? "col-span-2 min-h-[150px]" : "min-h-[104px]"}`;
  if (p.kind === "empty") {
    return (
      <div role="group" aria-label={panelLabel(p)} className={`${base} border-dashed border-[#A7ADA6] bg-[#ECEEE8] pb-6 text-center text-xs text-ink/70`}>
        <span className={CAP}>{p.cap}</span>
        {p.hint && <span>{p.hint}</span>}
      </div>
    );
  }
  if (p.kind === "feel") {
    const speed = SPEED[p.quad];
    return (
      <div role="group" aria-label={panelLabel(p)} className={`${base} comic-dots flex-row gap-3 border-ink`} style={{ backgroundColor: p.tone }}>
        {p.speed && speed && <SpeedLines color={speed} />}
        <span className={CAP}>{p.cap}</span>
        <span aria-hidden className="comic-bubble-sm relative z-[2] max-w-[150px] text-center text-[13px]">
          {p.line}
        </span>
        <Face look={look} pics={pics} expr={p.expr} className="size-[84px]" />
        <span aria-hidden className={BOX}>
          {p.box}
        </span>
      </div>
    );
  }
  if (p.kind === "play") {
    return (
      <div role="group" aria-label={panelLabel(p)} className={`${base} comic-dots border-ink bg-white`}>
        <span className={CAP}>{p.cap}</span>
        <Face look={look} pics={pics} expr={p.expr} className="size-12" />
        <span aria-hidden className={BOX}>
          {p.box}
        </span>
      </div>
    );
  }
  return (
    <div role="group" aria-label={panelLabel(p)} className={`${base} comic-dots border-ink ${p.kind === "done" ? "bg-[#F3EFE4]" : "bg-white"}`}>
      <span className={CAP}>{p.cap}</span>
      <span aria-hidden className="text-[34px] leading-none">
        {p.emoji}
      </span>
      <span aria-hidden className={BOX}>
        {p.box}
      </span>
    </div>
  );
}
