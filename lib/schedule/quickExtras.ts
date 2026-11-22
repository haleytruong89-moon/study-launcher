import { fold } from "@/lib/timetable/rules";
import { PLACE_LABEL, cleanSessions, dayShort, type ExtraClass, type ExtraSession, type Place } from "./rules";

/** An app the class can give homework on (the child's non-placeholder app slots). */
export interface SlotChoice {
  id: string;
  label: string;
}

export interface QuickExtra {
  subject: string;
  sessions: ExtraSession[];
  place: Place;
  appSlotId: string | null;
  bring: string;
  note: string;
}

export type QuickExtrasResult = { ok: true; classes: QuickExtra[] } | { ok: false; errors: string[] };

export const QUICK_EXTRAS_HEADER = "# Môn | Buổi (thứ + giờ; nhiều buổi cách nhau bằng ;) | Ở đâu | Cô giao bài ở (app) | Cần mang";
const MAX_CLASSES = 20;

const DAY_TOKEN: Record<string, number> = { t2: 1, t3: 2, t4: 3, t5: 4, t6: 5, t7: 6, cn: 7 };
const PLACE_WORDS: [string, Place][] = [
  ["o nha", "home"],
  ["nha", "home"],
  ["home", "home"],
  ["online", "online"],
  ["truc tuyen", "online"],
  ["trung tam", "center"],
  ["center", "center"],
  ["lop", "center"],
];

/** "T5 T6 T7 CN 20:30-22:30" (also "T3,T5 8h30 - 10h") → sessions, or a Vietnamese error. */
function parseSessions(cell: string): ExtraSession[] | string {
  const out: ExtraSession[] = [];
  for (const group of cell.split(";").map((g) => g.trim()).filter(Boolean)) {
    const m = /^(.*?)(\d{1,2}(?:[:hH]\d{0,2})?)\s*[-–]\s*(\d{1,2}(?:[:hH]\d{0,2})?)$/.exec(group);
    if (!m) return `"${group}": ghi thứ rồi giờ, vd "T3 15:30-17:00".`;
    const days = m[1]!
      .toLowerCase()
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map((t) => DAY_TOKEN[t]);
    if (days.length === 0 || days.some((d) => d === undefined)) return `"${group}": thứ viết T2 … T7 hoặc CN.`;
    for (const day of days) out.push({ day: day as number, start: m[2]!, end: m[3]! });
  }
  if (out.length === 0) return "Thiếu buổi học (thứ + giờ).";
  return out;
}

/**
 * "Dán học thêm" (parent, 22/11/2026): one line per class, cells split by "|":
 *   Gia sư Tiếng Anh | T5 T6 T7 CN 20:30-22:30 | Online | English OS | Tai nghe
 *   Văn | T3 13:30-15:30; T5 14:30-16:30 | Trung tâm | |
 * Môn and Buổi are required; Ở đâu defaults to Trung tâm; the app must be one of `slots` (by its
 * name, any case / accents); a 6th cell is the note. Blank lines and lines starting with "#" are
 * skipped. One line per subject (put all its sessions on that line). Pure.
 */
export function parseQuickExtras(text: string, slots: readonly SlotChoice[]): QuickExtrasResult {
  const errors: string[] = [];
  const classes: QuickExtra[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const at = `Dòng ${i + 1}`;
    const cells = line.split("|").map((c) => c.trim());
    const [subject = "", when = "", where = "", app = "", bring = "", note = ""] = cells;
    if (!subject) return void errors.push(`${at}: thiếu tên môn.`);
    if (subject.length > 30) return void errors.push(`${at}: tên môn dài quá (tối đa 30 chữ).`);
    const key = fold(subject);
    if (seen.has(key)) return void errors.push(`${at}: "${subject}" đã có ở dòng trên — gộp các buổi vào 1 dòng, cách nhau bằng ;`);
    const parsed = parseSessions(when);
    if (typeof parsed === "string") return void errors.push(`${at}: ${parsed}`);
    const sessions = cleanSessions(parsed);
    if (typeof sessions === "string") return void errors.push(`${at}: ${sessions}`);
    let place: Place = "center";
    if (where) {
      const w = fold(where);
      const hit = PLACE_WORDS.find(([word]) => w === word || w.startsWith(`${word} `));
      if (!hit) return void errors.push(`${at}: "Ở đâu" ghi Ở nhà, Trung tâm hoặc Online.`);
      place = hit[1];
    }
    let appSlotId: string | null = null;
    if (app) {
      const slot = slots.find((s) => fold(s.label) === fold(app));
      if (!slot) return void errors.push(`${at}: chưa có app "${app}" trong danh sách app của con (${slots.map((s) => s.label).join(", ") || "trống"}).`);
      appSlotId = slot.id;
    }
    if (bring.length > 120) return void errors.push(`${at}: phần cần mang dài quá.`);
    if (note.length > 120) return void errors.push(`${at}: ghi chú dài quá.`);
    seen.add(key);
    classes.push({ subject, sessions, place, appSlotId, bring, note });
  });
  if (classes.length > MAX_CLASSES) errors.push(`Tối đa ${MAX_CLASSES} môn học thêm.`);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, classes };
}

/** The child's current classes as the quick text (to edit and paste back). */
export function toQuickExtras(extras: readonly Pick<ExtraClass, "subject" | "sessions" | "place" | "appSlotId" | "bring" | "note" | "active">[], slots: readonly SlotChoice[]): string {
  const lines = [QUICK_EXTRAS_HEADER];
  for (const x of extras.filter((e) => e.active)) {
    // Sessions with the same time share one group: "T5 T6 T7 CN 20:30-22:30".
    const groups: { days: number[]; start: string; end: string }[] = [];
    for (const s of x.sessions) {
      const g = groups.find((g) => g.start === s.start && g.end === s.end);
      if (g) g.days.push(s.day);
      else groups.push({ days: [s.day], start: s.start, end: s.end });
    }
    const when = groups.map((g) => `${g.days.map(dayShort).join(" ")} ${g.start}-${g.end}`).join("; ");
    const app = x.appSlotId ? (slots.find((s) => s.id === x.appSlotId)?.label ?? "") : "";
    const cells = [x.subject, when, PLACE_LABEL[x.place], app, x.bring];
    if (x.note) cells.push(x.note);
    lines.push(cells.join(" | "));
  }
  return lines.join("\n");
}

/**
 * What saving the list does to the child's active classes (matched by subject, any case /
 * accents): update the ones still listed, add the new ones, turn off the ones left out. Pure.
 */
export function planQuickExtras(
  existing: readonly Pick<ExtraClass, "id" | "subject" | "active">[],
  classes: readonly QuickExtra[],
): { update: { id: string; data: QuickExtra }[]; insert: QuickExtra[]; off: string[] } {
  const active = existing.filter((e) => e.active);
  const update: { id: string; data: QuickExtra }[] = [];
  const insert: QuickExtra[] = [];
  const used = new Set<string>();
  for (const c of classes) {
    const old = active.find((e) => !used.has(e.id) && fold(e.subject) === fold(c.subject));
    if (old) {
      used.add(old.id);
      update.push({ id: old.id, data: c });
    } else insert.push(c);
  }
  return { update, insert, off: active.filter((e) => !used.has(e.id)).map((e) => e.id) };
}
