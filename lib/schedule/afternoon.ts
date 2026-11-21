import type { DayPlan } from "@/lib/timetable/rules";
import { PLACE_LABEL, type ExtraClass, type ExtraSession } from "./rules";

export interface StripBlock {
  start: string;
  end: string;
  kind: "school" | "extra" | "free";
  /** "Ở trường" / "Tiếng Anh · Trung tâm" / "Trống" / "Trống từ 17:30". */
  label: string;
}

/** The strip runs 12:00–22:30 (stretched when a class starts earlier or ends later). */
export const STRIP_FROM = "12:00";
export const STRIP_TO = "22:30";
/** Shorter gaps between two classes are not shown as free time. */
const MIN_FREE = 10;

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const CLOCK = /^\d{1,2}:\d{2}$/;
const norm = (t: string) => (t.length === 4 ? `0${t}` : t);

/**
 * "Chiều nay" (Lát 3, design screen 5, 21/11/2026): the afternoon and evening of a day as blocks in
 * time order — afternoon school, extra classes, and the free time between them
 * ("13:50–15:25 Ở trường → 15:30–17:30 Tiếng Anh → Trống từ 17:30"). Morning school is left out.
 * Overlapping classes are both listed (the clash warning is in Sửa lịch học). [] when the day has
 * no afternoon school and no extra class. Pure, display only: it never changes what is locked.
 */
export function afternoonStrip(plan: DayPlan | null, extrasToday: readonly { extra: ExtraClass; session: ExtraSession }[]): StripBlock[] {
  const busy: { from: number; to: number; kind: "school" | "extra"; label: string }[] = [];
  const pm = (plan?.periods ?? [])
    .filter((p) => p.session === "pm" && p.time)
    .map((p) => (p.time as string).split("-").map((t) => norm(t.trim())))
    .filter((t): t is [string, string] => t.length === 2 && CLOCK.test(t[0]!) && CLOCK.test(t[1]!));
  if (pm.length > 0) {
    busy.push({ from: Math.min(...pm.map((t) => toMin(t[0]))), to: Math.max(...pm.map((t) => toMin(t[1]))), kind: "school", label: "Ở trường" });
  }
  for (const { extra, session } of extrasToday) {
    const from = toMin(session.start);
    const to = toMin(session.end);
    if (to <= toMin(STRIP_FROM) || to <= from) continue; // a morning class
    busy.push({ from, to, kind: "extra", label: `${extra.subject} · ${PLACE_LABEL[extra.place]}` });
  }
  if (busy.length === 0) return [];
  busy.sort((a, b) => a.from - b.from || a.to - b.to);

  const from = Math.min(toMin(STRIP_FROM), ...busy.map((b) => b.from));
  const to = Math.max(toMin(STRIP_TO), ...busy.map((b) => b.to));
  const out: StripBlock[] = [];
  let cursor = from;
  for (const b of busy) {
    if (b.from - cursor >= MIN_FREE) out.push({ start: hm(cursor), end: hm(b.from), kind: "free", label: "Trống" });
    out.push({ start: hm(b.from), end: hm(b.to), kind: b.kind, label: b.label });
    cursor = Math.max(cursor, b.to);
  }
  if (to - cursor >= MIN_FREE) out.push({ start: hm(cursor), end: hm(to), kind: "free", label: `Trống từ ${hm(cursor)}` });
  return out;
}

/** Minutes of a block (for the bar widths). */
export const blockMinutes = (b: StripBlock): number => toMin(b.end) - toMin(b.start);

/** The block going on at `minutes` past midnight (the first one when classes overlap), else null. */
export function currentBlock(blocks: readonly StripBlock[], minutes: number): number | null {
  const i = blocks.findIndex((b) => toMin(b.start) <= minutes && minutes < toMin(b.end));
  return i < 0 ? null : i;
}

/** The strip is over (after its last block): the card hides. */
export const stripOver = (blocks: readonly StripBlock[], minutes: number): boolean => blocks.length === 0 || minutes >= toMin(blocks.at(-1)!.end);
