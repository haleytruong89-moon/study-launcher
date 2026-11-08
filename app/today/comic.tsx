"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { QUAD_EXPRESSION, defaultAvatar, type Avatar, type Expression } from "@/lib/avatar";
import type { AvatarPics } from "@/lib/avatarPics";
import { activityText, findActivity } from "@/lib/binhYen/catalog";
import { activityEmoji } from "@/lib/binhYen/emoji";
import { SPEED, comicCover, comicPages, ddmm, panelLabel, type ComicPage, type Panel, type PageCtx } from "@/lib/comic/model";
import type { DayState } from "@/lib/dayState";
import { addDays } from "@/lib/time";
import { parsePlayPlans, readPlayPlansRaw } from "@/lib/today/playPlan";
import type { WeekDay, WeekDaysView, WeekFeel } from "@/lib/today/weekDays";
import { Character } from "../avatar-face";

/**
 * R5 — Nguyên's comic (artifact `worldPanel` detective branch, `mangaPage`, `mangaCover`,
 * `mangaReader`; audit item M). Display only, built from stored KEYS: the day's milestones, the
 * last Góc bình yên visit (region / word / activity), today's skill title and the free-time plan
 * kept in this browser. Never the child's own written text. Feelings are child-only: this is
 * rendered on the child's screens only, with data from the child-only /api/week/days.
 */

// The free-time plans are read from this browser after hydration (server snapshot = none).
function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function usePlayPlans(): Record<string, string> {
  const raw = useSyncExternalStore(subscribeStorage, readPlayPlansRaw, () => null);
  return useMemo(() => parsePlayPlans(raw), [raw]);
}

/** Radial speed lines behind the face (red and yellow). Decorative. */
export function SpeedLines({ color }: { color: string }) {
  const lines = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return <line key={i} x1={50 + Math.cos(a) * 70} y1={50 + Math.sin(a) * 70} x2={50 + Math.cos(a) * 30} y2={50 + Math.sin(a) * 30} />;
  });
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
      <g stroke={color} strokeWidth="1.2" opacity=".55">
        {lines}
      </g>
    </svg>
  );
}

/** The character in a round ink frame. */
export function Face({ look, pics, expr, className }: { look: Avatar; pics: AvatarPics; expr: Expression; className: string }) {
  return (
    <div aria-hidden className={`relative z-[1] shrink-0 overflow-hidden rounded-full border-[3px] border-ink bg-[#FFFDF8] ${className}`}>
      <Character look={look} pics={pics} expr={expr} className="block size-full" />
    </div>
  );
}

const CAP = "absolute top-1.5 left-1.5 z-10 bg-ink px-2 py-0.5 text-[11px] font-extrabold tracking-wide text-white";
const BOX = "absolute bottom-1.5 left-1.5 z-10 border-2 border-ink bg-white px-1.5 py-0.5 text-center text-xs leading-snug min-[560px]:px-2 min-[560px]:text-[13px]";

/** One panel of a full page (artifact `.mp`). */
function PanelView({ p, look, pics }: { p: Panel; look: Avatar; pics: AvatarPics }) {
  const a = p.id === "A";
  const base = `relative flex min-h-[170px] flex-col items-center justify-center gap-1.5 overflow-hidden border-[3px] px-2.5 pt-8 pb-11 ${a ? "col-span-2 min-h-[260px] min-[560px]:flex-row min-[560px]:gap-5" : ""}`;
  if (p.kind === "empty") {
    return (
      <div role="group" aria-label={panelLabel(p)} className={`${base} border-dashed border-[#A7ADA6] bg-[#ECEEE8] text-center text-[13px] text-ink/70`}>
        <span className={CAP}>{p.cap}</span>
        {p.hint && <span>{p.hint}</span>}
      </div>
    );
  }
  if (p.kind === "feel") {
    const speed = SPEED[p.quad];
    return (
      <div role="group" aria-label={panelLabel(p)} className={`${base} comic-dots border-ink`} style={{ backgroundColor: p.tone }}>
        {p.speed && speed && <SpeedLines color={speed} />}
        <span className={CAP}>{p.cap}</span>
        <span aria-hidden className="comic-bubble">
          {p.line}
        </span>
        <Face look={look} pics={pics} expr={p.expr} className="size-[120px] min-[560px]:size-[170px]" />
        <span aria-hidden className="comic-sfx right-3 bottom-[52px] text-[22px] min-[560px]:top-[26px] min-[560px]:bottom-auto min-[560px]:text-[30px]">
          {p.sfx}
        </span>
        <span aria-hidden className={BOX}>
          {p.box.split(" · ")[0]} · <b>{p.box.split(" · ").slice(1).join(" · ")}</b>
        </span>
      </div>
    );
  }
  if (p.kind === "play") {
    return (
      <div role="group" aria-label={panelLabel(p)} className={`${base} comic-dots border-ink bg-white min-[560px]:flex-row min-[560px]:gap-2.5`}>
        <span className={CAP}>{p.cap}</span>
        <span aria-hidden className="comic-bubble left-tail">
          {p.line}
        </span>
        <Face look={look} pics={pics} expr={p.expr} className="size-[84px] min-[560px]:size-24" />
        <span aria-hidden className={`${BOX} right-1.5`}>
          {p.box}
        </span>
      </div>
    );
  }
  // act / done: a big picture, the optional sound and the caption box.
  return (
    <div role="group" aria-label={panelLabel(p)} className={`${base} comic-dots border-ink ${p.kind === "done" ? "bg-[#F3EFE4]" : "bg-white"}`}>
      <span className={CAP}>{p.cap}</span>
      <span aria-hidden className="text-[52px] leading-none">
        {p.emoji}
      </span>
      {p.kind === "done" && p.sfx && (
        <span aria-hidden className="comic-sfx right-1.5 bottom-[50px] text-[18px] min-[560px]:right-3 min-[560px]:bottom-[42px] min-[560px]:text-[22px]">
          {p.sfx}
        </span>
      )}
      <span aria-hidden className={`${BOX} right-1.5`}>
        {p.box}
      </span>
    </div>
  );
}

/** One day's page (artifact `.mpage-full` + `.mgrid`: A across, then B | C, then D | E). */
function PageView({ page, n, look, pics }: { page: ComicPage; n: number; look: Avatar; pics: AvatarPics }) {
  return (
    <article aria-label={`Trang ${page.label}`} className="w-full max-w-[760px] border-4 border-ink bg-[#FFFDF8] p-2.5 shadow-[6px_6px_0_rgba(28,31,29,.18)]">
      <div className="grid grid-cols-[1.2fr_1fr] gap-2">
        {page.panels.map((p) => (
          <PanelView key={p.id} p={p} look={look} pics={pics} />
        ))}
      </div>
      <footer className="mt-1.5 text-center text-xs font-bold">{n}</footer>
    </article>
  );
}

/** "Tuần 02 – 08/11", or "Tuần 30/11 – 06/12" across a month. */
function weekSpan(monday: string): string {
  const sunday = addDays(monday, 6);
  return monday.slice(5, 7) === sunday.slice(5, 7) ? `Tuần ${monday.slice(8, 10)} – ${ddmm(sunday)}` : `Tuần ${ddmm(monday)} – ${ddmm(sunday)}`;
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/).pop() ?? name;
}

/** Today's flags from DayState (fresher than the week, which reloads at most once a minute). */
function withToday(week: WeekDaysView, s: DayState): WeekDay[] {
  if (week.today !== s.localDate) return week.days;
  return week.days.map((d) => (d.date === s.localDate ? { ...d, study: d.study || s.part1.complete, skill: d.skill || s.part2.complete, play: d.play || s.free.startedAt !== null } : d));
}

/** Today's skill title for panel D: the first finished skill, else the first one. */
function skillTitle(s: DayState): string | null {
  const items = s.part2.items.filter((i) => !i.placeholder);
  return (items.find((i) => i.state === "done") ?? items[0])?.title ?? null;
}

// ---------------------------------------------------------------------------
// Hôm nay: "Trang truyện hôm nay" (artifact worldPanel, detective)
// ---------------------------------------------------------------------------

interface TodayPanel {
  id: string;
  cap: string;
  filled: boolean;
  hint: string;
  body: React.ReactNode;
  label: string;
}

function TodayPanelView({ p, fresh }: { p: TodayPanel; fresh: boolean }) {
  if (!p.filled) {
    return (
      <div role="group" aria-label={`${p.cap}: ${p.hint}`} className="flex min-h-[170px] flex-col items-center justify-center gap-1 border-[3px] border-dashed border-[#A7ADA6] bg-[#ECEEE8] p-2 text-center text-[13px] text-ink/70">
        <span className="font-semibold">{p.cap}</span>
        <span>{p.hint}</span>
      </div>
    );
  }
  return (
    <div role="group" aria-label={`${p.cap}: ${p.label}`} className={`relative flex min-h-[170px] flex-col gap-1.5 border-[3px] border-ink bg-white p-2 ${fresh ? "pop" : ""}`}>
      <span className="self-start bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white sm:text-[11px]">{p.cap}</span>
      {p.body}
    </div>
  );
}

/** The Cảm xúc frame (Hôm nay and the corner's "Xong rồi"): the word in a bubble, the face, the activity. */
export function FeelFrameBody({ feel, look, pics }: { feel: Pick<WeekFeel, "quad" | "label" | "activity">; look: Avatar; pics: AvatarPics }) {
  return (
    <>
      <span className="comic-bubble-sm self-end">{feel.label ? `${feel.label[0]?.toLocaleUpperCase("vi")}${feel.label.slice(1)}…` : "…"}</span>
      <div className="grid flex-1 place-items-center">
        <Face look={look} pics={pics} expr={QUAD_EXPRESSION[feel.quad]} className="size-[84px]" />
      </div>
      <small className="text-xs">{activityLine(feel.activity)}</small>
    </>
  );
}

/** "🌬️ Thở cho dịu lại", or "Gọi tên cảm xúc" (no activity, or an unknown key). */
export function activityLine(key: string | null): string {
  const a = key ? findActivity(key) : undefined;
  return a ? `${activityEmoji(a.key)} ${activityText(a, "detective").title}`.trim() : "Gọi tên cảm xúc";
}

export function ComicToday({
  week,
  s,
  look,
  pics,
  freeMinutes,
  byEnabled,
  color,
  onOpen,
}: {
  week: WeekDaysView;
  s: DayState;
  look: Avatar | null;
  pics: AvatarPics;
  freeMinutes: number;
  byEnabled: boolean;
  color: string;
  onOpen: () => void;
}) {
  const me = look ?? defaultAvatar("detective");
  const plans = usePlayPlans();
  const feel = byEnabled ? (week.days.find((d) => d.date === s.localDate)?.feel ?? null) : null;
  const doneStudy = s.part1.items.filter((i) => i.state === "done" && i.group !== "upcoming" && !i.placeholder).map((i) => `${i.title} ✓`);
  const studyLine = doneStudy.length === 0 ? "Bài hôm nay ✓" : `${doneStudy.slice(0, 2).join(" · ")}${doneStudy.length > 2 ? " · …" : ""}`;
  const skill = skillTitle(s);
  const plan = plans[s.localDate] ?? null;
  const playLine = plan ?? `${freeMinutes} phút của con`;

  const panels: TodayPanel[] = [];
  if (byEnabled) {
    panels.push({
      id: "feel",
      cap: "KHUNG 1 · CẢM XÚC",
      filled: !!feel,
      hint: "Ghé Góc bình yên",
      label: feel ? `${feel.label}, ${activityLine(feel.activity)}` : "",
      body: feel ? <FeelFrameBody feel={feel} look={me} pics={pics} /> : null,
    });
  }
  const bigEmoji = (e: string) => (
    <div aria-hidden className="grid flex-1 place-items-center text-[44px] leading-none">
      {e}
    </div>
  );
  panels.push(
    {
      id: "study",
      cap: "KHUNG 2 · HỌC TẬP",
      filled: s.part1.complete,
      hint: "Xong bài trên lớp",
      label: studyLine,
      body: (
        <>
          {bigEmoji("📚")}
          <small className="text-xs">{studyLine}</small>
        </>
      ),
    },
    {
      id: "skill",
      cap: "KHUNG 3 · KỸ NĂNG",
      filled: s.part2.complete,
      hint: "Xong kỹ năng",
      label: skill ? `${skill} ✓` : "Kỹ năng ✓",
      body: (
        <>
          {bigEmoji("📖")}
          <small className="text-xs">{skill ? `${skill} ✓` : "Kỹ năng ✓"}</small>
        </>
      ),
    },
    {
      id: "play",
      cap: "KHUNG 4 · GIỜ TỰ DO",
      filled: s.free.startedAt !== null,
      hint: `Có ${freeMinutes} phút của con`,
      label: `Yeah! ${playLine}`,
      body: (
        <>
          <span className="comic-bubble-sm self-end">Yeah!</span>
          <div className="grid flex-1 place-items-center">
            <Face look={me} pics={pics} expr="smile" className="size-[84px]" />
          </div>
          <small className="text-xs">{playLine}</small>
        </>
      ),
    },
  );

  // A panel that gets drawn while the child is on this screen pops in (once; not on page load).
  const [filledAtMount] = useState(() => new Set(panels.filter((p) => p.filled).map((p) => p.id)));

  return (
    <section aria-labelledby="comic-today" className="flex flex-col gap-3 rounded-[20px] bg-white p-4" style={{ boxShadow: "0 6px 18px rgba(28,31,29,0.08)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="comic-today" className="text-[19px] font-bold">
          Trang truyện hôm nay
        </h2>
        <button type="button" onClick={onOpen} className="min-h-11 text-sm font-semibold underline" style={{ color }}>
          Xem Tập của tuần →
        </button>
      </div>
      <p className="-mt-2 text-[13px] text-ink/70">Mỗi mảng con làm xong là một khung được vẽ thêm.</p>
      <div className={`grid grid-cols-2 gap-2 border-4 border-ink bg-[#FFFDF8] p-2 ${panels.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        {panels.map((p) => (
          <TodayPanelView key={p.id} p={p} fresh={p.filled && !filledAtMount.has(p.id)} />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tab 4: "Tập của tuần" (artifact mangaReader)
// ---------------------------------------------------------------------------

export function ComicVolume({
  week,
  s,
  look,
  pics,
  name,
  icon,
  freeMinutes,
  color,
}: {
  week: WeekDaysView;
  s: DayState;
  look: Avatar | null;
  pics: AvatarPics;
  /** The child's display name (the cover uses the character's name first). */
  name: string;
  icon: string | null;
  freeMinutes: number;
  color: string;
}) {
  const me = look ?? defaultAvatar("detective");
  const plans = usePlayPlans();
  const [page, setPage] = useState(0);
  // A volume from the shelf being read (read-only), and its loading state.
  const [old, setOld] = useState<WeekDaysView | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [shelfError, setShelfError] = useState(false);

  const shown = old ?? week;
  const days = old ? old.days : withToday(week, s);
  const ctx: PageCtx = {
    today: week.today,
    byEnabled: shown.byEnabled,
    skillTitleToday: old ? null : skillTitle(s),
    freeMinutes,
    playPlan: (d) => plans[d] ?? null,
  };
  const pages = comicPages(days, ctx);
  const toc = comicCover(pages, days, week.today);
  const last = pages.length; // 0 = cover
  const k = Math.max(0, Math.min(last, page));
  const go = (n: number) => setPage(Math.max(0, Math.min(last, n)));

  async function openOld(weekStart: string) {
    setLoading(weekStart);
    setShelfError(false);
    try {
      const res = await fetch(`/api/week/days?week=${weekStart}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setOld((await res.json()) as WeekDaysView);
      setPage(0);
    } catch {
      setShelfError(true);
    } finally {
      setLoading(null);
    }
  }

  const coverName = me.name || firstNameOf(name);
  const dots = ["Bìa", ...toc.map((t) => t.short)];
  const dotNames = ["Bìa", ...toc.map((t) => t.weekday)];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="comic-volume" className="text-[19px] font-bold">
          📕 Tập {shown.volume} · {old ? weekSpan(old.weekStart).toLocaleLowerCase("vi") : "tuần này"}
        </h2>
        <span className="text-[13px] text-ink/70">Chủ nhật tập được đóng lại, lên kệ truyện</span>
      </div>
      {old && (
        <button type="button" onClick={() => { setOld(null); setPage(0); }} className="btn self-start border-[1.5px] bg-white text-sm" style={{ borderColor: color, color }}>
          ← Về tập tuần này
        </button>
      )}

      <div
        className="flex flex-col items-center gap-3"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(k - 1);
          else if (e.key === "ArrowRight") go(k + 1);
        }}
      >
        {k === 0 ? (
          <article
            aria-label={`Bìa tập ${shown.volume}`}
            className="flex w-full max-w-[760px] flex-col items-center gap-2.5 border-4 border-ink bg-[linear-gradient(160deg,#1F2E48,#2F5D9E)] p-[22px] text-center text-white shadow-[6px_6px_0_rgba(28,31,29,.18)]"
          >
            <span className="border-2 border-white px-2.5 py-0.5 text-sm font-black tracking-[.14em]">TẬP {shown.volume}</span>
            <div aria-hidden className="size-[160px] overflow-hidden rounded-full border-[5px] border-white bg-[#FFFDF8] min-[560px]:size-[200px]">
              <Character look={me} pics={pics} expr="calm" className="block size-full" />
            </div>
            <h3 className="text-[26px] font-black min-[560px]:text-[28px]">Thám tử {coverName}</h3>
            <p>
              {weekSpan(shown.weekStart)}
              {icon ? ` · ${icon}` : ""}
            </p>
            <ol aria-label="Mục lục" className="mt-1.5 flex w-full max-w-[420px] flex-col gap-1">
              {toc.map((t) => (
                <li key={t.page}>
                  <button
                    type="button"
                    onClick={() => go(t.page)}
                    className="grid min-h-11 w-full grid-cols-[80px_32px_1fr] items-center gap-2 rounded-[10px] border border-white/40 bg-white/10 px-3 text-left"
                  >
                    <span>{t.weekday}</span>
                    <span aria-hidden>{t.emoji}</span>
                    <span>{t.word}</span>
                  </button>
                </li>
              ))}
            </ol>
          </article>
        ) : (
          pages[k - 1] && <PageView page={pages[k - 1]!} n={k} look={me} pics={pics} />
        )}

        <nav aria-label="Lật trang" className="flex flex-wrap items-center justify-center gap-2.5">
          <button type="button" disabled={k === 0} onClick={() => go(k - 1)} className="btn border-[1.5px] border-ink/15 bg-white text-sm disabled:opacity-40">
            ← Trang trước
          </button>
          <span className="order-first flex basis-full flex-wrap justify-center gap-1 sm:order-none sm:basis-auto">
            {dots.map((d, i) => (
              <button
                key={`${d}-${i}`}
                type="button"
                aria-label={dotNames[i]}
                aria-current={i === k ? "true" : undefined}
                onClick={() => go(i)}
                className="min-h-11 min-w-11 rounded-full border-[1.5px] px-1 text-[13px] font-bold"
                style={i === k ? { background: color, borderColor: color, color: "#fff" } : { background: "#fff", borderColor: "rgb(28 31 29 / 0.15)" }}
              >
                {d}
              </button>
            ))}
          </span>
          <button type="button" disabled={k === last} onClick={() => go(k + 1)} className="btn border-[1.5px] border-ink/15 bg-white text-sm disabled:opacity-40">
            Trang sau →
          </button>
        </nav>
      </div>

      {week.shelf.length > 0 && (
        <div role="group" aria-label="Kệ truyện" className="flex flex-wrap items-center gap-2">
          <b className="text-[13px]">Kệ truyện</b>
          {week.shelf.map((v) => (
            <button
              key={v.weekStart}
              type="button"
              disabled={loading !== null}
              aria-pressed={old?.weekStart === v.weekStart}
              aria-label={`Tập ${v.volume}, ${weekSpan(v.weekStart).toLocaleLowerCase("vi")}`}
              onClick={() => void openOld(v.weekStart)}
              className={`comic-spine min-h-16 w-[54px] rounded border-2 border-ink text-xs font-extrabold text-white disabled:opacity-60 ${old?.weekStart === v.weekStart ? "outline-3 outline-offset-2" : ""}`}
              style={old?.weekStart === v.weekStart ? { outlineColor: color } : undefined}
            >
              {loading === v.weekStart ? "…" : `Tập ${v.volume}`}
            </button>
          ))}
          {shelfError && (
            <p role="alert" className="basis-full text-sm text-ink/75">
              Chưa mở được tập này, thử lại sau.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

