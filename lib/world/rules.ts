import { WORLDS, WORLD_ORDER, WORLD_START_MONTH, findThing, findWorld } from "./catalog";
import type { Animal, Icon, Pillar, World } from "./types";
import { PILLARS } from "./types";

/**
 * R4 rules (docs/MAN_CHINH_MOI.md §4, parent decisions 07/11/2026). PURE.
 *
 * - One plant per area per finished day; what grew is stored (world_items), never recomputed.
 * - "Cách 2": the k-th plant of an area in the month is thing (k mod n) of that area's list, at
 *   growth level floor(k / n). So the first n plants bring n NEW things; the next ones make them
 *   grow and open their 2nd, then 3rd fact. Nothing wilts, nothing is lost, no streak.
 * - Animals come (and stay) once the month's plants have the tags they need.
 */

export const MAX_FACTS = 3;

export interface WorldRow {
  local_date: string;
  pillar: Pillar;
  world_key: string;
  item_key: string;
  variant: number;
}

/** "2026-11-07" → "2026-11" */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

const ym = (month: string) => ({ y: Number(month.slice(0, 4)), m: Number(month.slice(5, 7)) });

export function prevMonth(month: string): string {
  const { y, m } = ym(month);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function monthsBetween(a: string, b: string): number {
  const x = ym(a);
  const z = ym(b);
  return (z.y - x.y) * 12 + (z.m - x.m);
}

export function isMonth(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/**
 * The world of a month when the child has not picked one: the first world (fixed order) that has
 * a pack and was not used in the 11 months before. null = no new pack yet: the month waits
 * ("sắp mở") instead of repeating a world — nothing is lost, the plants are made from the
 * stored milestones once the pack arrives.
 */
export function defaultWorld(month: string, used: readonly { month: string; worldKey: string }[]): string | null {
  const available = WORLD_ORDER.filter((k) => WORLDS[k]);
  const before = used.filter((u) => u.month < month && monthsBetween(u.month, month) <= 11);
  return available.find((k) => !before.some((u) => u.worldKey === k)) ?? null;
}

/** What the k-th plant (0-based) of an area in this world's month is. */
export function pick(world: World, pillar: Pillar, k: number): { itemKey: string; variant: number } {
  const list = world.things[pillar];
  const thing = list[k % list.length];
  if (!thing) throw new Error(`world ${world.key}: no ${pillar} list`);
  return { itemKey: thing.key, variant: Math.min(99, Math.floor(k / list.length)) };
}

/**
 * New rows for finished areas that have no plant yet, in day order (then feel, study, skill,
 * play), all in `worldKey`. `existing` = this month's rows.
 */
export function plantsToAdd(done: readonly { date: string; pillar: Pillar }[], existing: readonly WorldRow[], worldKey: string): WorldRow[] {
  const world = findWorld(worldKey);
  if (!world) return [];
  const have = new Set(existing.map((r) => `${r.local_date}|${r.pillar}`));
  const counts: Record<Pillar, number> = { feel: 0, study: 0, skill: 0, play: 0 };
  for (const r of existing) counts[r.pillar] += 1;
  const todo = [...new Map(done.map((d) => [`${d.date}|${d.pillar}`, d])).values()]
    .filter((d) => !have.has(`${d.date}|${d.pillar}`))
    .sort((a, b) => (a.date === b.date ? PILLARS.indexOf(a.pillar) - PILLARS.indexOf(b.pillar) : a.date < b.date ? -1 : 1));
  return todo.map((d) => {
    const p = pick(world, d.pillar, counts[d.pillar]);
    counts[d.pillar] += 1;
    return { local_date: d.date, pillar: d.pillar, world_key: worldKey, item_key: p.itemKey, variant: p.variant };
  });
}

// ---------------------------------------------------------------------------
// What the child sees (only the facts already opened leave the server)
// ---------------------------------------------------------------------------

export interface ThingView {
  key: string;
  name: string;
  icon: Icon;
  pillar: Pillar;
  /** How many times it grew this month (1 = new). */
  count: number;
  /** "05/11" */
  firstDate: string;
  facts: string[];
  /** Facts still to open by growing it again. */
  closed: number;
  mission: string;
  teach: string;
  today: boolean;
}

export interface AnimalView {
  key: string;
  name: string;
  icon: Icon;
  because: string;
  arrived: string;
  facts: string[];
  mission: string;
  teach: string;
  today: boolean;
}

export interface MonthView {
  month: string;
  world: { key: string; name: string; emoji: string; sky: string; land: string; intro: string; pillarNames: Record<Pillar, string> };
  things: ThingView[];
  animals: AnimalView[];
  /** Things of this world not grown yet (never named: a gentle "còn … đang chờ"). */
  waiting: number;
  plants: number;
}

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

function animalReady(a: Animal, tagCount: Map<string, number>): boolean {
  return a.needs.every((n) => (tagCount.get(n.tag) ?? 0) >= n.n);
}

/** The month as the child sees it. Rows of another world (or unknown keys) are skipped, never break the page. */
export function monthView(month: string, worldKey: string, rows: readonly WorldRow[], today: string): MonthView | null {
  const world = findWorld(worldKey);
  if (!world) return null;
  const mine = rows
    .filter((r) => r.world_key === worldKey && monthOf(r.local_date) === month)
    .sort((a, b) => (a.local_date === b.local_date ? PILLARS.indexOf(a.pillar) - PILLARS.indexOf(b.pillar) : a.local_date < b.local_date ? -1 : 1));
  const things = new Map<string, ThingView>();
  const tagged = new Map<string, Set<string>>();
  const animals: AnimalView[] = [];
  for (const r of mine) {
    const found = findThing(world, r.item_key);
    if (!found) continue;
    const { thing, pillar } = found;
    const v = things.get(thing.key);
    if (v) {
      v.count += 1;
      if (r.local_date === today) v.today = true;
    } else {
      things.set(thing.key, { key: thing.key, name: thing.name, icon: thing.icon, pillar, count: 1, firstDate: dm(r.local_date), facts: [], closed: 0, mission: thing.mission, teach: thing.teach, today: r.local_date === today });
    }
    for (const tag of thing.tags) {
      const set = tagged.get(tag) ?? new Set<string>();
      set.add(thing.key);
      tagged.set(tag, set);
    }
    const tagCount = new Map([...tagged].map(([t, s]) => [t, s.size]));
    for (const a of world.animals) {
      if (animals.some((x) => x.key === a.key) || !animalReady(a, tagCount)) continue;
      animals.push({ key: a.key, name: a.name, icon: a.icon, because: a.because, arrived: dm(r.local_date), facts: [...a.facts], mission: a.mission, teach: a.teach, today: r.local_date === today });
    }
  }
  for (const v of things.values()) {
    const all = findThing(world, v.key)?.thing.facts ?? [];
    const open = Math.min(MAX_FACTS, v.count, all.length);
    v.facts = all.slice(0, open);
    v.closed = all.length - open;
  }
  const total = PILLARS.reduce((n, p) => n + world.things[p].length, 0);
  return {
    month,
    world: { key: world.key, name: world.name, emoji: world.emoji, sky: world.sky, land: world.land, intro: world.intro, pillarNames: world.pillarNames },
    things: [...things.values()],
    animals,
    waiting: total - things.size,
    plants: mine.length,
  };
}

export interface WorldResponse {
  view: MonthView | null;
  current: boolean;
  album: { month: string; key: string; name: string; emoji: string; plants: number }[];
}

export function worldStarted(month: string): boolean {
  return month >= WORLD_START_MONTH;
}
