/**
 * Lịch học con tự quản (parent decisions 21/11/2026): extra classes (học thêm / gia sư) and the
 * subject list, PURE. Display only: nothing here changes what locks or opens the laptop.
 * Weekdays: 1 = Thứ 2 … 6 = Thứ 7, 7 = Chủ nhật (isoWeekday). Timetable periods use 1..6 only.
 */
import { addDays, isoWeekday } from "@/lib/time";
import { subjectKey, type Period, type TimetableVersion } from "@/lib/timetable/rules";

export type Place = "home" | "center" | "online";
export const PLACES: readonly Place[] = ["home", "center", "online"];
export const PLACE_LABEL: Record<Place, string> = { home: "Ở nhà", center: "Trung tâm", online: "Online" };

export interface ExtraSession {
  day: number;
  start: string;
  end: string;
}

export interface ExtraClass {
  id: string;
  childId: string;
  subject: string;
  sessions: ExtraSession[];
  place: Place;
  bring: string;
  note: string;
  /** The app the teacher gives homework on (English OS…): Lát 2 "làm trước buổi học thêm". */
  appSlotId: string | null;
  active: boolean;
}

export interface Busy {
  day: number;
  start: string;
  end: string;
  label: string;
  kind: "school" | "extra";
  extraId?: string;
}

export interface SubjectPref {
  key: string;
  label: string;
  color: string;
  bring: string;
}

export interface SubjectRow {
  key: string;
  label: string;
  perWeek: number;
  color: string;
  bring: string;
  extraDays: number[];
}

export const MAX_SESSIONS = 7;
export const SUBJECT_COLORS = ["#3B6FB6", "#B4432E", "#2B7A6F", "#7A5AA8", "#A8650F", "#4C8A3A", "#8A5A3B", "#3C8A8F"] as const;
const DAY_SHORT = ["", "T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export const dayShort = (day: number): string => DAY_SHORT[day] ?? "";
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** "8h30", "8h", "08:30", "8" → "08:30" / "08:00"; anything else → null. */
export function normClock(raw: string): string | null {
  const m = /^(\d{1,2})(?:[:hH](\d{2})?)?$/.exec(raw.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2] ?? "0");
  return h <= 23 && mm <= 59 ? `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}` : null;
}

/** The sessions the child typed → clean and sorted, or a Vietnamese error. */
export function cleanSessions(raw: unknown): ExtraSession[] | string {
  if (!Array.isArray(raw) || raw.length === 0) return "Thêm ít nhất 1 buổi.";
  if (raw.length > MAX_SESSIONS) return `Tối đa ${MAX_SESSIONS} buổi một tuần.`;
  const out: ExtraSession[] = [];
  for (const item of raw as unknown[]) {
    const r = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const day = r.day;
    if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > 7) return "Có buổi sai thứ.";
    const start = typeof r.start === "string" ? normClock(r.start) : null;
    const end = typeof r.end === "string" ? normClock(r.end) : null;
    if (!start || !end) return "Giờ chưa đúng (vd 15:30).";
    if (toMin(end) <= toMin(start)) return "Giờ kết thúc phải sau giờ bắt đầu.";
    out.push({ day, start, end });
  }
  return out.sort((a, b) => a.day - b.day || toMin(a.start) - toMin(b.start));
}

/** "T3 15:30–17:00, T5 13:00–14:30". */
export const sessionsText = (s: readonly ExtraSession[]): string => s.map((x) => `${dayShort(x.day)} ${x.start}–${x.end}`).join(", ");

/** School hours per weekday and session, from the period times (no times = unknown = not busy). */
export function schoolBusy(v: TimetableVersion | null): Busy[] {
  if (!v) return [];
  const out: Busy[] = [];
  for (let day = 1; day <= 6; day++) {
    for (const session of ["am", "pm"] as const) {
      const spans = v.periods
        .filter((p) => p.day === day && p.session === session)
        .map((p) => v.times[session]?.[String(p.n)])
        .filter((t): t is string => !!t)
        .map((t) => t.split("-") as [string, string]);
      if (spans.length === 0) continue;
      const start = spans.map((s) => s[0]).sort()[0]!;
      const end = spans
        .map((s) => s[1])
        .sort()
        .at(-1)!;
      out.push({ day, start, end, label: session === "am" ? "Học sáng ở trường" : "Học chiều ở trường", kind: "school" });
    }
  }
  return out;
}

/** The other active extra classes as busy spans (the one being edited is skipped). */
export function extraBusy(extras: readonly ExtraClass[], skipId?: string): Busy[] {
  return extras
    .filter((e) => e.active && e.id !== skipId)
    .flatMap((e) => e.sessions.map((s) => ({ day: s.day, start: s.start, end: s.end, label: `Học thêm ${e.subject}`, kind: "extra" as const, extraId: e.id })));
}

/** Sessions that overlap something busy (touching ends do not count). Warnings only. */
export function conflicts(sessions: readonly ExtraSession[], busy: readonly Busy[]): { session: ExtraSession; with: Busy }[] {
  const out: { session: ExtraSession; with: Busy }[] = [];
  for (const s of sessions) for (const b of busy) if (b.day === s.day && toMin(s.start) < toMin(b.end) && toMin(b.start) < toMin(s.end)) out.push({ session: s, with: b });
  return out;
}

/** The extra classes on a date, earliest first. */
export function extrasOn(extras: readonly ExtraClass[], date: string): { extra: ExtraClass; session: ExtraSession }[] {
  const wd = isoWeekday(date);
  return extras
    .filter((e) => e.active)
    .flatMap((e) => e.sessions.filter((s) => s.day === wd).map((session) => ({ extra: e, session })))
    .sort((a, b) => toMin(a.session.start) - toMin(b.session.start));
}

const slotName = (p: Pick<Period, "day" | "session" | "n">) => `${dayShort(p.day)}${p.session === "pm" ? " chiều" : ""} tiết ${p.n}`;

/** "T4 tiết 3: Thể dục → Toán" for every period that changed (Nhật ký). */
export function diffPeriods(before: readonly Period[], after: readonly Period[]): string[] {
  const key = (p: Period) => `${p.day}|${p.session}|${p.n}`;
  const a = new Map(before.map((p) => [key(p), p]));
  const b = new Map(after.map((p) => [key(p), p]));
  const rank = (k: string) => {
    const [d, s, n] = k.split("|");
    return Number(d) * 100 + (s === "pm" ? 50 : 0) + Number(n);
  };
  const keys = [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => rank(x) - rank(y));
  const out: string[] = [];
  for (const k of keys) {
    const p = a.get(k);
    const q = b.get(k);
    if (p && q && p.subject !== q.subject) out.push(`${slotName(p)}: ${p.subject} → ${q.subject}`);
    else if (p && !q) out.push(`${slotName(p)}: bỏ ${p.subject}`);
    else if (!p && q) out.push(`${slotName(q)}: thêm ${q.subject}`);
  }
  return out;
}

const BRING: Record<string, string> = {
  "the duc": "Giày thể thao, nước",
  "my thuat": "Bút màu, giấy vẽ",
  toan: "Thước, compa",
  chaoco: "Khăn quàng đỏ",
};

/** Suggested extra things to pack (every subject: sách + vở). The child edits it. */
export const defaultBring = (key: string): string => BRING[key] ?? "";

/** The child's subjects: from the timetable in force, plus extra-class subjects; prefs override. */
export function subjectRows(v: TimetableVersion | null, extras: readonly ExtraClass[], prefs: readonly SubjectPref[]): SubjectRow[] {
  const rows = new Map<string, SubjectRow>();
  const add = (name: string) => {
    const key = subjectKey(name);
    let row = rows.get(key);
    if (!row) {
      row = { key, label: name, perWeek: 0, color: "", bring: defaultBring(key), extraDays: [] };
      rows.set(key, row);
    }
    return row;
  };
  for (const p of v?.periods ?? []) add(p.subject).perWeek += 1;
  for (const e of extras) {
    if (!e.active) continue;
    const r = add(e.subject);
    for (const s of e.sessions) if (!r.extraDays.includes(s.day)) r.extraDays.push(s.day);
    r.extraDays.sort((a, b) => a - b);
  }
  [...rows.values()].forEach((r, i) => {
    const pref = prefs.find((p) => p.key === r.key);
    r.color = pref?.color || SUBJECT_COLORS[i % SUBJECT_COLORS.length]!;
    if (pref?.label) r.label = pref.label;
    if (pref?.bring) r.bring = pref.bring;
  });
  return [...rows.values()].sort((a, b) => b.perWeek - a.perWeek || a.label.localeCompare(b.label, "vi"));
}

/** The child may edit the version in force or start a new one, from that day up to 60 days ahead. */
export function childValidFromOk(validFrom: string, current: string | null, today: string): string | null {
  const floor = current ?? today;
  if (validFrom < floor) return "Không sửa được bản trước bản đang dùng.";
  if (validFrom > addDays(today, 60)) return "Chỉ đặt ngày áp dụng trong 60 ngày tới.";
  return null;
}

/** A database row → an extra class (bad shapes become empty, never trusted). */
export function fromExtraRow(r: {
  id: string;
  child_id: string;
  subject: string;
  sessions: unknown;
  place: string;
  bring: string | null;
  note: string | null;
  app_slot_id: string | null;
  active: boolean;
}): ExtraClass {
  const s = cleanSessions(r.sessions);
  return {
    id: r.id,
    childId: r.child_id,
    subject: r.subject,
    sessions: typeof s === "string" ? [] : s,
    place: (PLACES as readonly string[]).includes(r.place) ? (r.place as Place) : "home",
    bring: r.bring ?? "",
    note: r.note ?? "",
    appSlotId: r.app_slot_id,
    active: r.active,
  };
}
