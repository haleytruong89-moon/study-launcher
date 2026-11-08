"use client";

import type { AnimalView, MonthView, ThingView } from "@/lib/world/rules";
import type { Move, Pillar } from "@/lib/world/types";
import { WorldIcon } from "../world-icon";

/**
 * R6b: the living scene of An's world (the artifact "Màn chính bấm thử", item G). A drawn
 * background per world, things in their layer (each in a fixed place, whatever grows first),
 * visitors that fly / hop / swim / float, clouds or bubbles, a glow on what grew today.
 * Motion stops for people who ask for less (globals.css). Only shows what the server sent.
 */

export type SceneKey = "rung" | "bien" | "vu_tru" | "nui_lua";
const sceneOf = (key: string): SceneKey | null => (key === "rung" || key === "bien" || key === "vu_tru" || key === "nui_lua" ? key : null);

/** Height of each area's layer (% from the top), per world. */
const ROWS: Record<SceneKey, Record<Pillar, number>> = {
  rung: { study: 28, skill: 48, feel: 73, play: 88 },
  bien: { play: 36, study: 64, feel: 77, skill: 89 },
  vu_tru: { feel: 15, study: 36, skill: 57, play: 85 },
  nui_lua: { study: 42, play: 59, skill: 74, feel: 89 },
};
const DEFAULT_ROWS: Record<Pillar, number> = { study: 30, skill: 52, feel: 71, play: 87 };

/**
 * Heights where visitors live, per world and by how they move: in the bands between the
 * things' rows, so a visitor never sits on a thing and takes its tap (R6b review).
 */
const MOVE_ROWS: Record<SceneKey, Record<Move, readonly number[]>> = {
  rung: { fly: [12], float: [12], swim: [38], hop: [61], still: [61] },
  bien: { fly: [16], float: [16], swim: [16, 50], hop: [50], still: [50] },
  vu_tru: { fly: [26, 47], float: [26, 47], swim: [26, 47], hop: [71], still: [71] },
  nui_lua: { fly: [14, 26], float: [14, 26], swim: [26], hop: [24, 14], still: [26] },
};
const DEFAULT_MOVE_ROWS: Record<Move, readonly number[]> = { fly: [14], float: [14], swim: [41], hop: [61], still: [61] };

const THING_MOTION: Record<SceneKey, string> = { rung: "w-sway", bien: "w-sway", vu_tru: "w-twinkle", nui_lua: "" };
const MOVE_CLASS: Record<Move, string> = { fly: "w-fly", hop: "w-hop", swim: "w-swim", float: "w-float", still: "" };

/**
 * 6 things per area in fixed columns; the top-right corner stays clear for nothing (the count
 * is in the heading). Kept inside the frame so a grown (48 px) thing is not cut at the edge.
 */
export function thingPlace(t: Pick<ThingView, "pillar" | "slot">, rows: Record<Pillar, number>): { left: number; top: number } {
  const left = 9 + (t.slot % 6) * 16.4;
  const top = rows[t.pillar] + (t.slot % 2 === 0 ? -2 : 2);
  return { left: Math.min(left, 90), top: Math.min(top, 87) };
}

/** Visitors sit between the things' columns, in their world's free bands. */
export function animalPlace(a: Pick<AnimalView, "slot" | "move">, scene: SceneKey | null): { left: number; top: number } {
  const ys = (scene ? MOVE_ROWS[scene] : DEFAULT_MOVE_ROWS)[a.move];
  return { left: 17.2 + (a.slot % 5) * 16.4, top: ys[Math.floor(a.slot / 5) % ys.length] ?? ys[0] ?? 50 };
}

/** Size grows with how many times it grew (1 → 4+), never shrinks. */
const sizeOf = (count: number) => 30 + Math.min(count - 1, 3) * 6;

export type Picked = { kind: "thing"; key: string } | { kind: "animal"; key: string };

export { ROWS, sceneOf };

export function LivingScene({ view, picked, onPick, compact = false }: { view: MonthView; picked?: Picked | null; onPick?: (p: Picked) => void; compact?: boolean }) {
  const scene = sceneOf(view.world.key);
  const rows = scene ? ROWS[scene] : DEFAULT_ROWS;
  const motion = scene ? THING_MOTION[scene] : "";
  const dark = view.world.dark;
  const live = !compact && !!onPick;
  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border-4 ${compact ? "aspect-[16/7]" : "aspect-[4/3] sm:aspect-[16/9]"}`}
      style={{ borderColor: dark ? "#4B5390" : "#BFE6DF", background: `linear-gradient(${view.world.sky} 55%, ${view.world.land} 55%)` }}
    >
      {scene && <Backdrop scene={scene} />}
      {scene && <Ambient scene={scene} />}
      <ul aria-label="Những thứ đã mọc" className="absolute inset-0" aria-hidden={live ? undefined : true}>
        {view.things.map((t, i) => {
          const at = thingPlace(t, rows);
          const on = picked?.kind === "thing" && picked.key === t.key;
          return (
            <li key={t.key} className="absolute" style={{ left: `${at.left}%`, top: `${at.top}%`, transform: "translate(-50%, -50%)", zIndex: Math.round(at.top) }}>
              <Spot
                spot={`thing:${t.key}`}
                live={live}
                label={`${t.name}, đã mọc ${t.count} lần${t.today ? ", có mọc hôm nay" : ""}`}
                pressed={on}
                glow={t.today}
                motion={motion}
                delay={(i % 5) * 0.4}
                onClick={() => onPick?.({ kind: "thing", key: t.key })}
              >
                <WorldIcon icon={t.icon} size={compact ? Math.round(sizeOf(t.count) * 0.75) : sizeOf(t.count)} />
              </Spot>
            </li>
          );
        })}
      </ul>
      <ul aria-label={`Các ${view.world.visitorWord} ghé thăm`} className="absolute inset-0" aria-hidden={live ? undefined : true}>
        {view.animals.map((a, i) => {
          const at = animalPlace(a, scene);
          const on = picked?.kind === "animal" && picked.key === a.key;
          return (
            <li key={a.key} className="absolute" style={{ left: `${at.left}%`, top: `${at.top}%`, transform: "translate(-50%, -50%)", zIndex: 100 }}>
              <Spot
                spot={`animal:${a.key}`}
                live={live}
                label={`${a.name}, đến ngày ${a.arrived}${a.today ? ", mới đến hôm nay" : ""}`}
                pressed={on}
                glow={a.today}
                motion={MOVE_CLASS[a.move]}
                delay={(i % 4) * 0.7}
                onClick={() => onPick?.({ kind: "animal", key: a.key })}
              >
                <WorldIcon icon={a.icon} size={compact ? 26 : 36} />
              </Spot>
            </li>
          );
        })}
      </ul>
      {view.things.length === 0 && (
        <p className={`absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-center text-sm font-semibold ${dark ? "bg-black/30 text-white" : "bg-white/80 text-ink/80"}`}>
          Còn trống. Xong mảng đầu tiên hôm nay là có thứ mới!
        </p>
      )}
    </div>
  );
}

function Spot({ spot, live, label, pressed, glow, motion, delay, onClick, children }: { spot: string; live: boolean; label: string; pressed: boolean; glow: boolean; motion: string; delay: number; onClick: () => void; children: React.ReactNode }) {
  const inner = (
    <span className={`block ${motion} ${glow ? "w-glow" : ""}`} style={{ animationDelay: `${delay}s`, filter: glow ? undefined : "drop-shadow(0 2px 2px rgba(0,0,0,.28))" }}>
      {children}
    </span>
  );
  if (!live) return inner;
  return (
    <button
      type="button"
      data-spot={spot}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl focus-visible:outline-3 focus-visible:outline-[#1C1F1D] focus-visible:ring-2 focus-visible:ring-white ${pressed ? "bg-white/55 ring-2 ring-white" : "hover:bg-white/30"}`}
    >
      {inner}
    </button>
  );
}

/** Clouds (rừng), bubbles (biển), twinkling stars (vũ trụ), smoke (núi lửa). Decorative. */
function Ambient({ scene }: { scene: SceneKey }) {
  if (scene === "rung")
    return (
      <span aria-hidden>
        <span className="w-cloud" style={{ top: "7%", animationDuration: "38s" }} />
        <span className="w-cloud w-cloud-sm" style={{ top: "17%", animationDuration: "52s", animationDelay: "-20s" }} />
      </span>
    );
  if (scene === "nui_lua")
    return (
      <span aria-hidden>
        <span className="w-cloud w-smoke" style={{ top: "5%", animationDuration: "46s" }} />
        <span className="w-cloud w-cloud-sm w-smoke" style={{ top: "14%", animationDuration: "60s", animationDelay: "-25s" }} />
      </span>
    );
  if (scene === "bien")
    return (
      <span aria-hidden>
        {[12, 33, 58, 81].map((x, i) => (
          <span key={x} className="w-bubble" style={{ left: `${x}%`, animationDelay: `${-i * 2.3}s`, animationDuration: `${7 + i}s` }} />
        ))}
      </span>
    );
  return (
    <span aria-hidden>
      {[
        [8, 9],
        [27, 6],
        [44, 12],
        [63, 5],
        [79, 14],
        [91, 30],
        [5, 44],
        [52, 50],
      ].map(([x, y], i) => (
        <span key={`${x}-${y}`} className="w-star" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${-i * 0.9}s` }} />
      ))}
    </span>
  );
}

/** The drawn background (viewBox 400×300, cropped to fill). */
function Backdrop({ scene }: { scene: SceneKey }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden className="absolute inset-0 size-full">
      {scene === "rung" && <Forest />}
      {scene === "bien" && <Sea />}
      {scene === "vu_tru" && <Space />}
      {scene === "nui_lua" && <Volcano />}
    </svg>
  );
}

function Forest() {
  const tree = (cx: number, s: number) => (
    <g key={cx}>
      <rect x={cx - 7 * s} y={118} width={14 * s} height={96} rx={6} fill="#7A5638" />
      <ellipse cx={cx} cy={108} rx={46 * s} ry={40 * s} fill="#4E8C4F" />
      <ellipse cx={cx - 24 * s} cy={124} rx={28 * s} ry={24 * s} fill="#3E7A40" />
      <ellipse cx={cx + 22 * s} cy={122} rx={26 * s} ry={22 * s} fill="#5EA05A" />
    </g>
  );
  return (
    <>
      <defs>
        <linearGradient id="w-fsky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#BFE4F5" />
          <stop offset="1" stopColor="#E8F6EC" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#w-fsky)" />
      <circle cx="292" cy="40" r="22" fill="#FFE081" />
      <path d="M0 150 Q100 112 200 150 T400 150 V300 H0 Z" fill="#AEDB8F" />
      <path d="M0 184 Q120 150 240 186 T400 182 V300 H0 Z" fill="#8FCB6E" />
      {tree(30, 1)}
      {tree(372, 0.9)}
      <rect y="200" width="400" height="100" fill="#7DBE5F" />
      {Array.from({ length: 12 }, (_, i) => (
        <circle key={i} cx={8 + i * 36} cy={208} r={20 + (i % 3) * 6} fill="#79C05C" />
      ))}
      <path d="M0 252 Q40 246 80 252 T160 252 T240 252 T320 252 T400 252 V300 H0 Z" fill="#7A5433" />
      {[70, 170, 270, 350].map((x) => (
        <path key={x} d={`M${x} 252 q-6 18 -16 30 M${x} 252 q8 16 20 26`} stroke="#5A3E24" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      ))}
    </>
  );
}

function Sea() {
  return (
    <>
      <defs>
        <linearGradient id="w-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9FDCF2" />
          <stop offset="0.55" stopColor="#3C93C4" />
          <stop offset="1" stopColor="#1F5F8E" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#w-water)" />
      <path d="M0 14 Q25 6 50 14 T100 14 T150 14 T200 14 T250 14 T300 14 T350 14 T400 14 V0 H0 Z" fill="#DFF4FB" />
      {[60, 160, 270].map((x) => (
        <polygon key={x} points={`${x},14 ${x + 30},14 ${x + 70},240 ${x + 10},240`} fill="#FFFFFF" opacity="0.12" />
      ))}
      <path d="M0 250 Q60 236 130 248 T260 244 T400 250 V300 H0 Z" fill="#E6CF98" />
      <path d="M0 272 Q80 262 170 272 T400 268 V300 H0 Z" fill="#D8BC7E" />
      <ellipse cx="40" cy="252" rx="26" ry="12" fill="#8C8C84" />
      <ellipse cx="350" cy="248" rx="32" ry="14" fill="#7C7D76" />
    </>
  );
}

function Space() {
  return (
    <>
      <defs>
        <linearGradient id="w-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141833" />
          <stop offset="1" stopColor="#2E3463" />
        </linearGradient>
        <radialGradient id="w-galaxy">
          <stop offset="0" stopColor="#C9B8FF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#C9B8FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill="url(#w-night)" />
      <ellipse cx="300" cy="90" rx="90" ry="26" fill="url(#w-galaxy)" transform="rotate(-18 300 90)" />
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={(i * 97) % 400} cy={(i * 53) % 260} r={i % 5 === 0 ? 1.6 : 0.9} fill="#FFFFFF" opacity={0.5 + (i % 3) * 0.2} />
      ))}
      <path d="M0 270 Q200 240 400 270 V300 H0 Z" fill="#4A5088" />
      <circle cx="90" cy="282" r="6" fill="#3B4078" />
      <circle cx="300" cy="278" r="9" fill="#3B4078" />
    </>
  );
}

function Volcano() {
  return (
    <>
      <defs>
        <linearGradient id="w-dusk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F7DCC0" />
          <stop offset="1" stopColor="#F0B58A" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#w-dusk)" />
      <path d="M90 190 L180 70 H220 L310 190 Z" fill="#6B4A3A" />
      <path d="M180 70 Q200 58 220 70 L212 82 Q200 76 188 82 Z" fill="#F26B3A" />
      <path d="M196 78 Q190 110 200 140 Q206 110 204 78 Z" fill="#F28A3A" opacity="0.85" />
      <path d="M0 200 Q80 170 160 196 T400 190 V300 H0 Z" fill="#8A6A55" />
      <path d="M0 232 Q100 218 200 232 T400 228 V300 H0 Z" fill="#6E5242" />
      <path d="M0 262 Q90 254 200 262 T400 258 V300 H0 Z" fill="#4E392E" />
      <path d="M40 276 l30 6 l26 -4 M250 270 l24 8 l30 -6" stroke="#E8552B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </>
  );
}
