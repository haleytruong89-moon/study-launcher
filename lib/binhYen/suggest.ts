/**
 * R1 — three suggested activities (docs/BINH_YEN.md §5 R1). PURE: tests encode every row of
 * the gold table ("Đáp án đề xuất").
 *
 * 1. The quadrant says which kind of care fits (QUAD_NEED); the word and the cause add weight.
 * 2. Each activity of the child's own list scores Σ tag weight × need, plus a word boost.
 *    Activities limited to some quadrants are left out elsewhere; "Nhắn bố mẹ" is offered by
 *    the weights only for a strong need of people (minScore), never for mild boredom.
 * 3. The three highest (ties: the list order). Something doable right now goes first (an
 *    activity marked lead:false, e.g. "ngủ sớm", is never first when another is there).
 * 4. Unpleasant (red / blue) with intensity ≥ 4 → "Nhắn bố mẹ" first, always.
 */
import {
  CAUSE_NEED,
  POOLS,
  QUAD_NEED,
  WORD_NEED,
  WORD_NEED_BY_VOICE,
  findActivity,
  isPleasant,
  type Activity,
  type Need,
  type NeedMap,
  type Quad,
  type Voice,
} from "./catalog";

export const TALK_KEY = "talk";
/** Unpleasant with this intensity or more → "Nhắn bố mẹ" first. */
export const TALK_FIRST_INTENSITY = 4;

export interface SuggestInput {
  voice: Voice;
  quad: Quad;
  word: string;
  /** 1–5 for unpleasant quadrants; ignored for pleasant ones. */
  intensity?: number | null;
  /** S-BY3; S-BY1 never has one. */
  cause?: string | null;
}

function needFor(input: SuggestInput): NeedMap {
  const need: NeedMap = { ...QUAD_NEED[input.quad] };
  const add = (m: NeedMap | undefined) => {
    if (!m) return;
    for (const [k, v] of Object.entries(m) as [Need, number][]) need[k] = (need[k] ?? 0) + v;
  };
  add(WORD_NEED_BY_VOICE[input.voice]?.[input.word] ?? WORD_NEED[input.word]);
  if (input.cause) add(CAUSE_NEED[input.cause]);
  return need;
}

export function scoreActivity(a: Activity, need: NeedMap, word: string): number {
  let s = 0;
  for (const [tag, w] of Object.entries(a.tags) as [Need, number][]) s += w * (need[tag] ?? 0);
  return s + (a.boost?.[word] ?? 0);
}

/** The three activity keys to offer, best first. */
export function suggest(input: SuggestInput): string[] {
  const need = needFor(input);
  const pool = POOLS[input.voice]
    .map((key, idx) => ({ a: findActivity(key), idx }))
    .filter((x): x is { a: Activity; idx: number } => !!x.a && !x.a.retired && (!x.a.quads || x.a.quads.includes(input.quad)));
  const scored = pool
    .map(({ a, idx }) => ({ a, idx, s: scoreActivity(a, need, input.word) }))
    .sort((x, y) => y.s - x.s || x.idx - y.idx);

  const eligible = (x: { a: Activity; s: number }) => x.s > 0 && x.s >= (x.a.minScore ?? 0);
  const top = scored.filter(eligible).slice(0, 3).map((x) => x.a);
  // Fewer than three with a positive score: fill in the child's list order (never "talk" by filling).
  for (const { a } of pool) {
    if (top.length >= 3) break;
    if (!top.includes(a) && a.key !== TALK_KEY) top.push(a);
  }

  // Something doable now goes first.
  if (top[0] && top[0].lead === false) {
    const i = top.findIndex((a) => a.lead !== false);
    if (i > 0) top.unshift(...top.splice(i, 1));
  }

  let keys = top.map((a) => a.key);
  if (!isPleasant(input.quad) && (input.intensity ?? 0) >= TALK_FIRST_INTENSITY && POOLS[input.voice].includes(TALK_KEY)) {
    keys = [TALK_KEY, ...keys.filter((k) => k !== TALK_KEY)].slice(0, 3);
  }
  return keys.slice(0, 3);
}
