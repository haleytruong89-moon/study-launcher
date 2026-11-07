/**
 * The world of the month (R4, docs/MAN_CHINH_MOI.md §4). Plain data, used on the server (what
 * grows) and in the browser (how it looks). Keys are stable forever: a world, a thing or an
 * animal is only ever ADDED, never removed or renamed (old plants keep their key).
 */

export type Pillar = "feel" | "study" | "skill" | "play";
export const PILLARS: readonly Pillar[] = ["feel", "study", "skill", "play"];

/** A small drawing for things that have no good emoji (drawn by app/world-icon.tsx). */
export type SvgShape =
  | "bloom"
  | "tree"
  | "fruit"
  | "pod"
  | "pitcher"
  | "patch"
  | "bark"
  | "glow"
  | "figs"
  | "fern"
  | "star"
  // R4b
  | "orb"
  | "spark"
  | "swirl"
  | "hole"
  | "branch"
  | "brain"
  | "blades"
  | "shell"
  | "seahorse"
  | "urchin"
  | "slug"
  | "jelly"
  | "dugong"
  | "probe"
  | "rover"
  | "aurora"
  // R4c
  | "crystal"
  | "volcano"
  | "rock"
  | "geyser"
  | "columns"
  | "lake"
  | "quake"
  | "tubes";
export interface SvgIcon {
  shape: SvgShape;
  /** Main colour. */
  color: string;
  /** Second colour (centre, trunk, spots…). */
  accent?: string;
  /** Petals / points. */
  n?: number;
}
export type Icon = { emoji: string } | { svg: SvgIcon };

/** Three true things to learn: the 1st when it first grows, the 2nd and 3rd when it grows again. */
export type Facts = readonly [string, string, string];

export interface Thing {
  key: string;
  name: string;
  icon: Icon;
  /** What the thing is good for in the world: animals come because of these. */
  tags: readonly string[];
  facts: Facts;
  /** "Nhiệm vụ ngoài đời" (optional to do; nothing is stored about it). */
  mission: string;
  /** "Tối nay dạy cả nhà": one sentence the child can teach at dinner. */
  teach: string;
}

/** An animal comes (and stays) once the world has at least `n` different things with `tag`, for every need. */
export interface Animal {
  key: string;
  name: string;
  icon: Icon;
  needs: readonly { tag: string; n: number }[];
  /** Why it came, shown on its card: "Đến vì …". */
  because: string;
  facts: Facts;
  mission: string;
  teach: string;
}

export interface World {
  key: string;
  name: string;
  emoji: string;
  /** What each area grows here ("Hoa", "Cây lớn"…). */
  pillarNames: Record<Pillar, string>;
  things: Record<Pillar, readonly Thing[]>;
  animals: readonly Animal[];
  /** What the visitors are called: "con vật" (rừng, biển), "vị khách" (vũ trụ). */
  visitorWord: string;
  /** First month the pack may be offered ("2027-01"); none = any month. */
  from?: string;
  /** Night scene (Vũ trụ): light text on it. */
  dark?: boolean;
  /** Scene colours: sky, land. */
  sky: string;
  land: string;
  intro: string;
}
