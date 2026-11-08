import { QUAD_EXPRESSION, type Expression } from "@/lib/avatar";
import { activityText, findActivity, type Quad } from "@/lib/binhYen/catalog";
import { activityEmoji, wordEmoji } from "@/lib/binhYen/emoji";
import type { WeekDay } from "@/lib/today/weekDays";

/**
 * Nguyên's comic (R5, artifact `mangaPage` / `mangaCover`): one page per day, made ONLY from keys
 * that are already stored — the day's milestones, the last Góc bình yên visit (region, word,
 * activity keys), today's skill title, and the free-time plan kept in this browser. No story is
 * written per day and no text the child typed is ever used: every line here is fixed copy.
 * Feelings are child-only, so this is used by child screens only. PURE (server and browser).
 */

export const LINE: Record<Quad, readonly [string, string]> = {
  red: ["Khoan… chưa kết luận vội!", "Hừm. Hồ sơ này nóng quá."],
  yellow: ["Hôm nay đáng thành một tập truyện!", "Manh mối tốt đây rồi!"],
  blue: ["Pin yếu rồi… nghỉ chút đã.", "Hôm nay hơi nặng nề."],
  green: ["Yên quá. Ý tưởng đang tới.", "Một ngày dịu dàng."],
};

export const SFX: Record<Quad, string> = { red: "GRRR!", yellow: "YAY!", blue: "hừm…", green: "~ phù ~" };

/** Screen-tone background of panel A per region. */
export const TONE: Record<Quad, string> = { red: "#F6DED8", yellow: "#F7ECCB", blue: "#DCE5F3", green: "#DCEDE0" };

/** Speed-line colour (red and yellow only). */
export const SPEED: Partial<Record<Quad, string>> = { red: "#8A3B2E", yellow: "#8A6A0E" };

const FILE_NAME: Record<Quad, string> = { red: "đỏ", yellow: "vàng", blue: "lam", green: "lục" };

export type PanelId = "A" | "B" | "C" | "D" | "E";
export type Panel =
  | { id: PanelId; kind: "empty"; cap: string; hint: string }
  | { id: "A"; kind: "feel"; cap: string; quad: Quad; line: string; sfx: string; expr: Expression; box: string; word: string; tone: string; speed: boolean }
  | { id: "B"; kind: "act"; cap: string; emoji: string; box: string }
  | { id: "C" | "D"; kind: "done"; cap: string; emoji: string; box: string; sfx: string | null }
  | { id: "E"; kind: "play"; cap: string; line: string; expr: Expression; box: string };

export interface ComicPage {
  date: string;
  label: string;
  panels: Panel[];
}

export interface PageCtx {
  /** Real today (Asia/Ho_Chi_Minh): "đang làm…" today, calm copy on a past day. */
  today: string;
  byEnabled: boolean;
  /** Title of today's skill (from DayState Part 2), or null. */
  skillTitleToday: string | null;
  freeMinutes: number;
  /** The free-time plan this browser remembers for a date (R6d), or null. */
  playPlan: (date: string) => string | null;
}

const WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"] as const;
const SHORTS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

function weekdayIndex(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** "dd/mm" of a local date. */
export function ddmm(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

/** "Thứ Hai · 02/11", "Chủ nhật · 08/11". */
export function dayLabelVi(date: string): string {
  return `${WEEKDAYS[weekdayIndex(date)]} · ${ddmm(date)}`;
}

export function comicPage(day: WeekDay, index: number, ctx: PageCtx): ComicPage {
  const label = dayLabelVi(day.date);
  const isToday = day.date === ctx.today;
  const f = day.feel;
  const panels: Panel[] = [];

  // A · the day: the feeling of the last visit (region, word), or an opening panel.
  if (f) {
    panels.push({
      id: "A",
      kind: "feel",
      cap: label,
      quad: f.quad,
      line: LINE[f.quad][index % 2] ?? LINE[f.quad][0],
      sfx: SFX[f.quad],
      expr: QUAD_EXPRESSION[f.quad],
      box: `Hồ sơ ${FILE_NAME[f.quad]} · ${f.label || "Góc bình yên"}`,
      word: f.label,
      tone: TONE[f.quad],
      speed: !!SPEED[f.quad],
    });
  } else {
    panels.push({ id: "A", kind: "empty", cap: label, hint: ctx.byEnabled ? "Khung mở đầu: ghé Góc bình yên để vẽ" : "" });
  }

  // B · "Cách xử lý": the activity of that visit, or naming it was enough.
  const act = f?.activity ? findActivity(f.activity) : undefined;
  if (f && act) panels.push({ id: "B", kind: "act", cap: "Cách xử lý", emoji: activityEmoji(act.key) || "🔎", box: activityText(act, "detective").title });
  else if (f) panels.push({ id: "B", kind: "act", cap: "Cách xử lý", emoji: "📝", box: "Gọi tên là đủ cho hôm nay" });
  else panels.push({ id: "B", kind: "empty", cap: "Cách xử lý", hint: "chưa vẽ" });

  // C · study (Part 1 milestone).
  panels.push(
    day.study
      ? { id: "C", kind: "done", cap: "Nhiệm vụ học", emoji: "📚", box: "Bài hôm nay ✓", sfx: "XONG!" }
      : { id: "C", kind: "empty", cap: "Nhiệm vụ học", hint: isToday ? "đang làm…" : "hôm nay chưa xong — không sao" },
  );

  // D · skill (Part 2 milestone). Only today's title is known (DayState); other days say "Kỹ năng".
  panels.push(
    day.skill
      ? { id: "D", kind: "done", cap: "Kỹ năng", emoji: "📖", box: isToday && ctx.skillTitleToday ? `${ctx.skillTitleToday} ✓` : "Kỹ năng ✓", sfx: null }
      : { id: "D", kind: "empty", cap: "Kỹ năng", hint: isToday ? "đang làm…" : "nghỉ" },
  );

  // E · free time: the plan this browser remembers, else the minutes.
  panels.push(
    day.play
      ? { id: "E", kind: "play", cap: "Giờ tự do", line: "Yeah!", expr: "smile", box: ctx.playPlan(day.date) ?? `${ctx.freeMinutes} phút tự do` }
      : { id: "E", kind: "empty", cap: "Giờ tự do", hint: isToday ? "xong hết là có" : "—" },
  );

  return { date: day.date, label, panels };
}

/** The pages of a week: Monday → today (days after today are not pages yet). */
export function comicPages(days: readonly WeekDay[], ctx: PageCtx): ComicPage[] {
  const out: ComicPage[] = [];
  days.forEach((d, i) => {
    if (!d.future) out.push(comicPage(d, i, ctx));
  });
  return out;
}

export interface CoverEntry {
  /** Reader page (0 = the cover). */
  page: number;
  weekday: string;
  /** "T2" … "CN": the pager dot. */
  short: string;
  emoji: string;
  word: string;
}

/** The cover's table of contents: one line per page (weekday, the word's emoji, the word). */
export function comicCover(pages: readonly ComicPage[], days: readonly WeekDay[], today: string): CoverEntry[] {
  return pages.map((p, i) => {
    const d = days.find((x) => x.date === p.date);
    const w = weekdayIndex(p.date);
    const base = { page: i + 1, weekday: WEEKDAYS[w] as string, short: SHORTS[w] as string };
    if (d?.feel) return { ...base, emoji: wordEmoji(d.feel.word, d.feel.quad) || "·", word: d.feel.label };
    return { ...base, emoji: "·", word: p.date === today ? "đang vẽ" : "" };
  });
}

/** What a screen reader hears for one panel (the drawing itself is decorative). */
export function panelLabel(p: Panel): string {
  if (p.kind === "feel") return `${p.cap}: ${p.line} ${p.box}`;
  if (p.kind === "empty") return p.hint ? `${p.cap}: ${p.hint}` : p.cap;
  if (p.kind === "play") return `${p.cap}: ${p.line} ${p.box}`;
  return `${p.cap}: ${p.box}`;
}
