/**
 * Thời khóa biểu (parent decisions 18/11/2026, SQL 0022). PURE: parse / write the quick text the
 * parents paste, pick the version in force on a day, the day's periods, tomorrow's uniform, and
 * the next day a subject is taught (the due date suggested in Giao bài).
 *
 * Weekdays: 1 = Thứ 2 … 6 = Thứ 7 (ISO Monday = 1); Sunday has no school.
 */
import { addDays, isoWeekday } from "@/lib/time";

export type Session = "am" | "pm";

export interface Period {
  day: number;
  session: Session;
  n: number;
  subject: string;
}

export interface TimetableData {
  label: string;
  note: string;
  periods: Period[];
  /** "07:30-08:15" per session and period number. */
  times: Partial<Record<Session, Record<string, string>>>;
  /**
   * Uniform text per weekday ("1".."6"), plus optional "pe" (21/11/2026): the uniform of a day that
   * has a Thể dục lesson (it wins over the weekday text, see uniformFor).
   */
  uniform: Record<string, string>;
}

export interface TimetableVersion extends TimetableData {
  id: string;
  childId: string;
  validFrom: string;
}

export const DAY_NAMES = ["", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"] as const;
export const MAX_PERIOD = 6;
/** Uniform key for "a day with a Thể dục lesson" (Nguyên, 21/11/2026). */
export const PE_KEY = "pe";
const SUBJECT_MAX = 30;
const TIME = /^(\d{1,2})[:hH](\d{2})\s*-\s*(\d{1,2})[:hH](\d{2})$/;

function hhmm(h: string, m: string): string | null {
  const hh = Number(h);
  const mm = Number(m);
  return hh <= 23 && mm <= 59 ? `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}` : null;
}

/** "7h30 - 8h15" → "07:30-08:15"; anything else → null. */
export function normTime(raw: string): string | null {
  const m = TIME.exec(raw.trim());
  if (!m) return null;
  const a = hhmm(m[1]!, m[2]!);
  const b = hhmm(m[3]!, m[4]!);
  return a && b && a < b ? `${a}-${b}` : null;
}

export type ParseResult = { ok: true; data: TimetableData } | { ok: false; errors: string[] };

/**
 * The quick text, one line each (line order does not matter; blank lines and lines starting with
 * "#" or "T2" are skipped):
 *   LỚP: 6A6
 *   GHI CHÚ: Có mặt 7h10 · Phòng A105
 *   S1 07:30-08:15 | CHAOCO | GDTC | KHTN(S) | Văn | Toán |
 *   C2 13:50-14:35 | LS&ĐL(ĐL) | KHTN(H) | | | |
 *   ĐỒNG PHỤC T2: Áo polo đỏ, quần thể thao…
 * "S" = buổi sáng, "C" = buổi chiều; then up to 6 cells for Thứ 2 … Thứ 7 (empty = no lesson).
 */
export function parseQuick(text: string): ParseResult {
  const errors: string[] = [];
  const data: TimetableData = { label: "", note: "", periods: [], times: {}, uniform: {} };
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    const at = `Dòng ${i + 1}`;
    if (line === "" || line.startsWith("#") || /^T2\b/i.test(line) || /^\|?\s*T2\s*\|/i.test(line)) return;
    let m = /^LỚP\s*:\s*(.*)$/iu.exec(line);
    if (m) {
      data.label = m[1]!.trim().slice(0, 40);
      return;
    }
    m = /^GHI CHÚ\s*:\s*(.*)$/iu.exec(line);
    if (m) {
      data.note = m[1]!.trim().slice(0, 200);
      return;
    }
    m = /^ĐỒNG PHỤC\s*THỂ DỤC\s*:\s*(.*)$/iu.exec(line.normalize("NFC"));
    if (m) {
      const text = m[1]!.trim().slice(0, 160);
      if (text) data.uniform[PE_KEY] = text;
      return;
    }
    m = /^ĐỒNG PHỤC\s*T([2-7])\s*:\s*(.*)$/iu.exec(line);
    if (m) {
      const text = m[2]!.trim().slice(0, 160);
      if (text) data.uniform[String(Number(m[1]) - 1)] = text;
      return;
    }
    m = /^([SC])\s*(\d)\s*([^|]*)\|(.*)$/iu.exec(line);
    if (!m) {
      errors.push(`${at}: không hiểu "${line.slice(0, 40)}"`);
      return;
    }
    const session: Session = m[1]!.toUpperCase() === "S" ? "am" : "pm";
    const n = Number(m[2]);
    if (n < 1 || n > MAX_PERIOD) {
      errors.push(`${at}: tiết phải từ 1 đến ${MAX_PERIOD}`);
      return;
    }
    const rowKey = `${session}${n}`;
    if (seen.has(rowKey)) {
      errors.push(`${at}: tiết ${m[1]!.toUpperCase()}${n} bị lặp`);
      return;
    }
    seen.add(rowKey);
    const timeRaw = m[3]!.trim();
    if (timeRaw) {
      const t = normTime(timeRaw);
      if (!t) errors.push(`${at}: giờ "${timeRaw}" chưa đúng (vd 07:30-08:15)`);
      else data.times[session] = { ...(data.times[session] ?? {}), [String(n)]: t };
    }
    const cells = m[4]!.split("|").map((c) => c.trim());
    if (cells.slice(6).some((c) => c !== "")) errors.push(`${at}: nhiều hơn 6 ô (Thứ 2 … Thứ 7)`);
    cells.slice(0, 6).forEach((cell, d) => {
      if (cell === "") return;
      if (cell.length > SUBJECT_MAX) errors.push(`${at}: tên môn "${cell.slice(0, 20)}…" dài quá`);
      else data.periods.push({ day: d + 1, session, n, subject: cell });
    });
  });
  if (errors.length === 0 && data.periods.length === 0) errors.push("Chưa có tiết nào (dòng bắt đầu bằng S1…S5 hoặc C1…C5).");
  return errors.length > 0 ? { ok: false, errors } : { ok: true, data: sortPeriods(data) };
}

function sortPeriods(d: TimetableData): TimetableData {
  const order = (p: Period) => p.day * 100 + (p.session === "am" ? 0 : 50) + p.n;
  return { ...d, periods: [...d.periods].sort((a, b) => order(a) - order(b)) };
}

/** Writes a version back as quick text (the editor starts from it). */
export function toQuick(d: TimetableData): string {
  const lines: string[] = [];
  if (d.label) lines.push(`LỚP: ${d.label}`);
  if (d.note) lines.push(`GHI CHÚ: ${d.note}`);
  lines.push("#   giờ          | T2 | T3 | T4 | T5 | T6 | T7");
  for (const session of ["am", "pm"] as const) {
    const rows = new Set(d.periods.filter((p) => p.session === session).map((p) => p.n));
    for (const n of Object.keys(d.times[session] ?? {}).map(Number)) rows.add(n);
    for (const n of [...rows].sort((a, b) => a - b)) {
      const cells = [1, 2, 3, 4, 5, 6].map((day) => d.periods.find((p) => p.session === session && p.n === n && p.day === day)?.subject ?? "");
      const time = d.times[session]?.[String(n)];
      lines.push(`${session === "am" ? "S" : "C"}${n}${time ? ` ${time}` : ""} | ${cells.join(" | ")} |`);
    }
  }
  for (const day of [1, 2, 3, 4, 5, 6]) {
    const u = d.uniform[String(day)];
    if (u) lines.push(`ĐỒNG PHỤC T${day + 1}: ${u}`);
  }
  if (d.uniform[PE_KEY]) lines.push(`ĐỒNG PHỤC THỂ DỤC: ${d.uniform[PE_KEY]}`);
  return lines.join("\n");
}

/** The version in force on `date`: the latest one that starts on or before it. */
export function versionOn<V extends { validFrom: string }>(versions: readonly V[], date: string): V | null {
  let best: V | null = null;
  for (const v of versions) if (v.validFrom <= date && (!best || v.validFrom > best.validFrom)) best = v;
  return best;
}

export interface DayPlan {
  date: string;
  weekday: number;
  periods: { session: Session; n: number; subject: string; time: string | null }[];
  uniform: string | null;
  note: string;
  label: string;
}

/** What the child has at school on `date` (null on Sunday or with no timetable). */
export function dayPlan(versions: readonly TimetableVersion[], date: string): DayPlan | null {
  const weekday = isoWeekday(date);
  const v = versionOn(versions, date);
  if (!v || weekday > 6) return null;
  const periods = v.periods
    .filter((p) => p.day === weekday)
    .map((p) => ({ session: p.session, n: p.n, subject: p.subject, time: v.times[p.session]?.[String(p.n)] ?? null }));
  return { date, weekday, periods, uniform: uniformFor(v, weekday), note: v.note, label: v.label };
}

/** The next school day after `date` that has lessons (within 7 days), for "Chuẩn bị cho ngày mai". */
export function nextSchoolDay(versions: readonly TimetableVersion[], date: string): DayPlan | null {
  for (let i = 1; i <= 7; i++) {
    const plan = dayPlan(versions, addDays(date, i));
    if (plan && plan.periods.length > 0) return plan;
  }
  return null;
}

/** "Chuẩn bị cho ngày mai" shows from 19:00 (Vietnam time). */
export const PREPARE_FROM = "19:00";

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();

/** Names that mean the same subject (folded: no accents, lower case). */
const GROUPS: readonly string[][] = [
  ["toan", "math", "maths"],
  ["anh", "tieng anh", "english", "ta"],
  ["van", "ngu van"],
  ["khtn", "khoa hoc tu nhien"],
  ["ly", "vat ly", "vat li", "li"],
  ["hoa", "hoa hoc"],
  ["sinh", "sinh hoc"],
  ["su", "lich su", "ls&dl(ls)", "ls"],
  ["dia", "dia ly", "dia li", "ls&dl(dl)", "dl"],
  ["gdcd", "cong dan"],
  ["tin", "tin hoc"],
  ["cong nghe", "cn"],
  // 21/11/2026: the PE uniform rule and the subject list need these.
  ["the duc", "gdtc", "giao duc the chat"],
  ["my thuat", "nt(mt)", "mt"],
  ["am nhac", "nhac", "nt(an)"],
];

/** A subject's group key ("Toán", "toán 9", "KHTN(S)" → "toan" / "khtn"), or its folded name. */
export function subjectKey(name: string): string {
  const f = fold(name);
  const exact = GROUPS.find((g) => g.includes(f));
  if (exact) return exact[0]!;
  const base = f.replace(/\(.*\)$/, "").replace(/\s+\d+$/, "").trim();
  const g = GROUPS.find((x) => x.includes(base));
  return g ? g[0]! : base;
}

/**
 * 21/11/2026: the subject named inside a longer class name ("Gia sư Tiếng Anh", "TA HSG", "Toán 9
 * nâng cao" → "anh" / "toan"). Falls back to `subjectKey`. Aliases match whole words only; the words
 * "gia sư" are ignored (else "sư" would read as Lịch sử) and the longest alias wins.
 */
export function subjectKeyIn(name: string): string {
  const direct = subjectKey(name);
  if (GROUPS.some((g) => g[0] === direct)) return direct;
  const words = ` ${fold(name).replace(/[^a-z0-9&()]+/g, " ").replace(/\bgia su\b/g, " ").replace(/\s+/g, " ").trim()} `;
  let best: { key: string; len: number } | null = null;
  for (const g of GROUPS) {
    for (const alias of g) {
      if (words.includes(` ${alias} `) && (!best || alias.length > best.len)) best = { key: g[0]!, len: alias.length };
    }
  }
  return best ? best.key : direct;
}

/**
 * Giao bài: the next day after `from` the subject is taught (up to 14 days ahead), as the
 * suggested due date. Null when the subject is not in the timetable.
 */
export function nextClassDate(versions: readonly TimetableVersion[], subject: string, from: string): string | null {
  const key = subjectKey(subject);
  if (!key) return null;
  for (let i = 1; i <= 14; i++) {
    const d = addDays(from, i);
    const plan = dayPlan(versions, d);
    if (plan?.periods.some((p) => subjectKey(p.subject) === key)) return d;
  }
  return null;
}

/**
 * The day's uniform (21/11/2026): a day with a Thể dục lesson wears `uniform.pe` when it is set
 * (Nguyên: áo xanh lá, it wins over "T2/T6 áo lớp"); otherwise that weekday's text. Sunday: null.
 */
export function uniformFor(v: Pick<TimetableData, "periods" | "uniform">, weekday: number): string | null {
  if (weekday < 1 || weekday > 6) return null;
  const pe = v.uniform[PE_KEY];
  if (pe && v.periods.some((p) => p.day === weekday && subjectKey(p.subject) === "the duc")) return pe;
  return v.uniform[String(weekday)] ?? null;
}

const record = (x: unknown): Record<string, unknown> => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {});

/** The child's editor sends a version as JSON (21/11/2026): the same limits as the quick text. */
export function validateData(raw: unknown): { ok: true; data: TimetableData } | { ok: false; error: string } {
  const o = record(raw);
  if (!Array.isArray(o.periods)) return { ok: false, error: "Thời khóa biểu không hợp lệ." };
  const seen = new Set<string>();
  const periods: Period[] = [];
  for (const raw of o.periods as unknown[]) {
    const p = record(raw);
    const { day, n, session } = p;
    const subject = typeof p.subject === "string" ? p.subject.trim() : "";
    if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > 6 || typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > MAX_PERIOD || (session !== "am" && session !== "pm"))
      return { ok: false, error: "Có tiết sai thứ hoặc số tiết." };
    if (!subject || subject.length > SUBJECT_MAX) return { ok: false, error: "Tên môn trống hoặc dài quá." };
    const k = `${day}${session}${n}`;
    if (seen.has(k)) return { ok: false, error: "Một tiết bị nhập hai lần." };
    seen.add(k);
    periods.push({ day, session, n, subject });
  }
  const times: TimetableData["times"] = {};
  const t = record(o.times);
  for (const s of ["am", "pm"] as const) {
    for (const [n, v] of Object.entries(record(t[s]))) {
      const norm = typeof v === "string" ? normTime(v) : null;
      if (!/^[1-6]$/.test(n) || !norm) return { ok: false, error: "Giờ tiết chưa đúng (vd 07:30-08:15)." };
      times[s] = { ...(times[s] ?? {}), [n]: norm };
    }
  }
  const uniform: Record<string, string> = {};
  for (const [k, v] of Object.entries(record(o.uniform))) {
    if (!/^[1-6]$/.test(k) && k !== PE_KEY) return { ok: false, error: "Đồng phục sai thứ." };
    if (typeof v !== "string" || v.length > 160) return { ok: false, error: "Đồng phục dài quá." };
    if (v.trim()) uniform[k] = v.trim();
  }
  const label = typeof o.label === "string" ? o.label.trim().slice(0, 40) : "";
  const note = typeof o.note === "string" ? o.note.trim().slice(0, 200) : "";
  return { ok: true, data: sortPeriods({ label, note, periods, times, uniform }) };
}

/** A row from the database → a version (bad shapes are dropped, never trusted). */
export function fromRow(r: { id: string; child_id: string; valid_from: string; label: string | null; note: string | null; periods: unknown; times: unknown; uniform: unknown }): TimetableVersion {
  const periods = Array.isArray(r.periods)
    ? (r.periods as Partial<Period>[]).filter(
        (p): p is Period =>
          typeof p?.day === "number" && p.day >= 1 && p.day <= 6 && (p.session === "am" || p.session === "pm") && typeof p.n === "number" && typeof p.subject === "string",
      )
    : [];
  const obj = (x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {});
  const strMap = (x: unknown) => Object.fromEntries(Object.entries(obj(x)).filter((e): e is [string, string] => typeof e[1] === "string"));
  const t = obj(r.times);
  return {
    id: r.id,
    childId: r.child_id,
    validFrom: r.valid_from,
    label: r.label ?? "",
    note: r.note ?? "",
    periods,
    times: { am: strMap(t.am), pm: strMap(t.pm) },
    uniform: strMap(r.uniform),
  };
}
