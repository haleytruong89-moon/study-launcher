import { BIEN } from "./bien";
import { RUNG } from "./rung";
import type { Animal, Pillar, Thing, World } from "./types";
import { VU_TRU } from "./vu_tru";

/**
 * The 12 worlds of the year (parent decision 07/11/2026): An picks one at the start of each month
 * (R4b); a world already used in the last 11 months is not offered again. Only worlds with a
 * content pack are in WORLDS; the rest are added month by month (one pack per PR, read first).
 */
export const WORLD_ORDER = [
  "rung",
  "bien",
  "vu_tru",
  "nui_lua",
  "cuc",
  "sa_mac",
  "dong_co",
  "hang_dong",
  "song_dam_lay",
  "bau_troi",
  "ti_hon",
  "khung_long",
] as const;

export const WORLDS: Readonly<Record<string, World>> = { rung: RUNG, bien: BIEN, vu_tru: VU_TRU };

/** The first month with a world (R4a shipped in November 2026). Earlier days grow nothing. */
export const WORLD_START_MONTH = "2026-11";

export function findWorld(key: string): World | undefined {
  return Object.prototype.hasOwnProperty.call(WORLDS, key) ? WORLDS[key] : undefined;
}

export function findThing(world: World, key: string): { thing: Thing; pillar: Pillar } | undefined {
  for (const pillar of ["feel", "study", "skill", "play"] as const) {
    const thing = world.things[pillar].find((t) => t.key === key);
    if (thing) return { thing, pillar };
  }
  return undefined;
}

export function findAnimal(world: World, key: string): Animal | undefined {
  return world.animals.find((a) => a.key === key);
}
