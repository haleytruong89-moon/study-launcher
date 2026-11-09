/**
 * Wording and small calculations for the child's "Hôm nay" screen (mockup Main.dc.html).
 * Pure functions, safe to use in client components. Display only: every decision is the server's.
 */
import { MIN_BREAK_MINUTES, type DayState, type TaskView, type WeekResult } from "@/lib/dayState";
import { addDays, isoWeekday } from "@/lib/time";
import { minutesLabel } from "@/lib/today/focus";
import { isExtraRun, runningItems, runningTimedTask } from "@/lib/today/rules";

export interface Banner {
  title: string;
  sub: string;
  tone: "lock" | "open" | "dark";
}

const WEEKDAY_SHORT: Record<number, string> = { 1: "T2", 2: "T3", 3: "T4", 4: "T5", 5: "T6", 6: "T7", 7: "CN" };
const WEEKDAY_LONG: Record<number, string> = {
  1: "Thứ Hai",
  2: "Thứ Ba",
  3: "Thứ Tư",
  4: "Thứ Năm",
  5: "Thứ Sáu",
  6: "Thứ Bảy",
  7: "Chủ Nhật",
};

/** "Thứ Tư, 15/10/2026" */
export function longDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${WEEKDAY_LONG[isoWeekday(date)]}, ${d}/${m}/${y}`;
}

/** "T4" or "Nay" for today. */
export function dayLabel(date: string, today: string): string {
  return date === today ? "Nay" : (WEEKDAY_SHORT[isoWeekday(date)] ?? "?");
}

/** "HH:MM" in Vietnam time for an ISO instant. */
export function vnTime(isoInstant: string): string {
  return new Date(new Date(isoInstant).getTime() + 7 * 3600_000).toISOString().slice(11, 16);
}

/** "mm:ss" (or "h:mm:ss") for a non-negative duration. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function remaining(part: { total: number; done: number }): number {
  return Math.max(0, part.total - part.done);
}

/** The big banner under the steps (one per status). */
export function bannerFor(state: DayState, rules: { breakMinutes: number; freeMinutes: number }): Banner {
  switch (state.status) {
    case "LOCK_P1":
      if (state.part1.pick.done < state.part1.pick.needed && !state.part1.items.some((i) => i.group === "due")) {
        const left = state.part1.pick.needed - state.part1.pick.done;
        return {
          title: "Hôm nay không có bài đến hạn",
          sub: `Tự chọn ${left} bài ở “Sắp tới” để làm trước${state.part1.total > state.part1.pick.needed ? ", rồi làm bài bổ sung" : ""}. Làm sớm là được ★.`,
          tone: "lock",
        };
      }
      if (state.part2.complete) {
        return {
          title: `Xong kỹ năng — còn ${remaining(state.part1)} bài tập`,
          sub: `${breakHint(state, rules)}Xong bài tập là đến giờ tự do ${rules.freeMinutes} phút.`,
          tone: "lock",
        };
      }
      return {
        title: `Còn ${remaining(state.part1)} bài tập · ${remaining(state.part2)} kỹ năng`,
        sub: `Bài tập và kỹ năng làm song song, con chọn thứ tự.${
          state.break.legacy
            ? rules.breakMinutes > 0 && (state.break.state === "not_yet" || state.break.state === "offer")
              ? " Xong một phần là được nghỉ."
              : ""
            : state.break.canStart
              ? ` ${breakHint(state, rules)}`.trimEnd()
              : ""
        }`,
        tone: "lock",
      };
    case "BREAK":
      return {
        title: "Đang nghỉ",
        sub: state.break.legacy
          ? "Hết giờ nghỉ máy tự khóa lại. Bấm “Học tiếp” để làm tiếp ngay."
          : "Hết giờ nghỉ máy tự khóa lại. Bấm “Học tiếp” để làm tiếp ngay, phút nghỉ còn lại để dành.",
        tone: "open",
      };
    case "LOCK_P2":
      return {
        title: `Xong bài tập — còn ${remaining(state.part2)} kỹ năng`,
        sub: `${breakHint(state, rules)}Xong kỹ năng là đến giờ tự do ${rules.freeMinutes} phút.`,
        tone: "lock",
      };
    case "FREE_READY":
      return {
        title: "Hôm nay không có việc nào",
        sub: `Bấm “Bắt đầu giờ tự do” khi con muốn: ${rules.freeMinutes} phút tính từ lúc bấm.`,
        tone: "dark",
      };
    case "FREE":
      return {
        title: state.part1.doneAt !== null && state.part2.doneAt !== null ? `Xong cả hai phần — giờ tự do` : "Giờ tự do",
        sub: "Gợi ý: ra sân, vẽ, Lego… Hết giờ máy khóa lại đến hết ngày.",
        tone: "open",
      };
    case "LOCK_END":
      return { title: "Đã hết giờ tự do hôm nay", sub: "Máy chỉ mở trang học đến 00:00. Mai gặp lại!", tone: "dark" };
    case "OPEN_SICK":
      return { title: "Hôm nay là ngày ốm", sub: "Máy mở cả ngày. Nghỉ ngơi cho khỏe nhé.", tone: "open" };
    case "OPEN_TRUST":
      return { title: "Chế độ Tin tưởng", sub: "Máy không chặn trang nào. Việc hôm nay vẫn ở dưới — tự giác nhé.", tone: "open" };
    case "OPEN_OVERRIDE":
      return {
        title: "Bố mẹ đã mở máy",
        sub: state.openUntil ? `Mở mọi trang đến ${vnTime(state.openUntil)}.` : "Mở mọi trang.",
        tone: "open",
      };
    case "LOCK_OVERRIDE":
      return { title: "Bố mẹ đang tạm khóa máy", sub: "Chỉ mở trang học. Việc hôm nay vẫn làm bình thường.", tone: "dark" };
  }
}

function breakHint(state: DayState, rules: { breakMinutes: number }): string {
  if (!state.break.canStart) return "";
  // R8b: the bank (whole minutes); before 0014 the fixed break_minutes.
  return `Con được nghỉ ${state.break.legacy ? rules.breakMinutes : state.break.bankMinutes} phút nếu muốn. `;
}

/**
 * R8b: the break line of the status card and the Vui chơi card (minutes only, calm). null when
 * there is nothing to say (free time started, open laptop, breaks off). Tier values come from the
 * server (`nextTier`), never from constants here.
 */
export function breakLine(state: DayState, nowMs: number): { text: string; hint: string | null; button: string | null } | null {
  const b = state.break;
  if (b.state === "running") {
    const left = b.endsAt ? Math.max(0, Math.ceil((new Date(b.endsAt).getTime() - nowMs) / 60_000)) : 0;
    return { text: `Đang nghỉ · còn ${left} phút`, hint: null, button: null };
  }
  if (b.legacy) return null; // before 0014: the old "Nghỉ 10 phút" button stays as it was
  if (state.free.startedAt !== null || b.maxPerDay === 0) return null;
  if (b.takenToday >= b.maxPerDay) return { text: `Hôm nay con đã nghỉ đủ ${b.maxPerDay} lần`, hint: null, button: null };
  const next = b.nextTier;
  if (b.bankMinutes >= MIN_BREAK_MINUTES) {
    const busy = !b.canStart && runningTimedTask(state) !== null;
    return {
      text: `Con đã tập trung ${b.blockFocusMinutes}' · nghỉ được ${b.bankMinutes}'`,
      hint: busy
        ? "Bấm Xong việc đang làm rồi nghỉ nhé"
        : next
          ? `Học thêm ${next.atFocus - b.blockFocusMinutes}' nữa (không nghỉ) để được nghỉ ${next.minutes}'`
          : null,
      button: b.canStart ? `Nghỉ ${b.bankMinutes}'` : null,
    };
  }
  if (!next) return null;
  const goal = `Tập trung đủ ${next.atFocus}' để được nghỉ ${next.minutes}'`;
  return { text: b.blockFocusMinutes > 0 ? `Con đã tập trung ${b.blockFocusMinutes}' · ${goal[0]?.toLowerCase()}${goal.slice(1)}` : goal, hint: null, button: null };
}

/** R8b: "Giờ tự do 45' + 30' nghỉ chưa dùng = 75'" — only when unused break minutes are added. */
export function freeBonusLine(state: DayState, freeMinutes: number): string | null {
  const bonus = state.free.bonusMinutes;
  if (bonus <= 0) return null;
  return `Giờ tự do ${freeMinutes}' + ${bonus}' nghỉ chưa dùng = ${freeMinutes + bonus}'`;
}

/**
 * Header steps (R1): Bài tập and Kỹ năng are done in any order, so each step is ticked on its
 * own; "Giờ tự do" is ticked once it has started (or ended). Display only.
 */
export function daySteps(state: DayState): { label: string; done: boolean }[] {
  return [
    { label: "Bài tập", done: state.part1.complete },
    { label: "Kỹ năng", done: state.part2.complete },
    { label: "Giờ tự do", done: state.free.startedAt !== null },
  ];
}

export function isOkResult(r: WeekResult): boolean {
  return r === "ok" || r === "pass" || r === "sick";
}

/** "5/6 ngày đạt" over the 6 days before today. */
export function weekSummary(week: DayState["week"]): string {
  const past = week.slice(0, -1);
  return `${past.filter((d) => isOkResult(d.result)).length}/${past.length} ngày đạt`;
}

/**
 * The big timer of Góc học tập's work panel (R6c), on the server clock: a timed task counts
 * down its minimum; running homework counts up; not started = 00:00 (or the minimum of a
 * timed task).
 */
export function timerMs(item: TaskView, nowMs: number): number {
  const timed = !item.requiresProof && item.minMinutes > 0;
  if (item.state === "running" && timed && item.canFinishAt) return Math.max(0, Date.parse(item.canFinishAt) - nowMs);
  if (item.state === "running" && item.startedAt) return Math.max(0, nowMs - Date.parse(item.startedAt));
  if (timed) return item.minMinutes * 60_000;
  return 0;
}

/** "Quá hạn 15/10" · "Hạn hôm nay" · "Hạn ngày mai" · "Hạn 20/10". */
export function dueLabel(dueDate: string, today: string): string {
  const dm = `${dueDate.slice(8, 10)}/${dueDate.slice(5, 7)}`;
  if (dueDate < today) return `Quá hạn ${dm}`;
  if (dueDate === today) return "Hạn hôm nay";
  if (dueDate === addDays(today, 1)) return "Hạn ngày mai";
  return `Hạn ${dm}`;
}

/** Heading note of the "Sắp tới" group (interpretation 17). */
export function upcomingHint(state: DayState): string {
  const { needed, done } = state.part1.pick;
  if (needed > 0) {
    return done >= needed
      ? `Đã chọn đủ ${needed} bài hôm nay — làm thêm càng tốt.`
      : `Hôm nay không có bài đến hạn: tự chọn ${needed} bài để làm trước (${Math.min(done, needed)}/${needed}).`;
  }
  return "Không bắt buộc hôm nay — làm trước hạn ≥ 2 ngày được ★ sớm.";
}

/** Second line under a task (what to do next / how long). */
export function taskMeta(item: TaskView, nowMs: number, today = ""): string {
  if (item.placeholder) return "Chưa có app — không tính vào việc phải làm";
  if (item.state === "done") {
    const took =
      item.startedAt && item.doneAt
        ? Math.max(1, Math.round((new Date(item.doneAt).getTime() - new Date(item.startedAt).getTime()) / 60_000))
        : null;
    return `Xong${took ? ` · ${took} phút` : ""}${item.requiresProof ? " · đã gửi ảnh cho bố mẹ" : ""}${item.early ? " · ★ sớm" : ""}`;
  }
  if (item.state === "running" && item.startedAt) {
    // R7a: minutes only, never a ticking seconds clock.
    const elapsed = minutesLabel(nowMs - new Date(item.startedAt).getTime());
    if (isExtraRun(item)) return `Đang làm thêm · ${elapsed} — không bắt buộc`;
    if (item.requiresProof) return `Đang làm · ${elapsed} — làm xong thì chụp ảnh bài`;
    if (item.canFinishAt && nowMs < new Date(item.canFinishAt).getTime())
      return nowMs - new Date(item.startedAt).getTime() < 60_000 ? `Đang làm · vừa bắt đầu · ít nhất ${item.minMinutes} phút` : `Đang làm · ${elapsed} / ${item.minMinutes} phút`;
    return `Đủ ${item.minMinutes} phút — bấm Xong khi làm xong`;
  }
  if (item.source === "homework") {
    const due = item.dueDate ? dueLabel(item.dueDate, today || item.dueDate) : "";
    return `${due} · không giới hạn thời gian · chụp ảnh khi xong`;
  }
  return item.minMinutes > 0 ? `Tối thiểu ${item.minMinutes} phút` : "Không giới hạn thời gian";
}

/** 0..100 progress toward the minimum time of a running template task. */
export function taskProgress(item: TaskView, nowMs: number): number {
  if (item.state !== "running" || !item.startedAt || item.minMinutes <= 0) return item.state === "done" ? 100 : 0;
  const pct = ((nowMs - new Date(item.startedAt).getTime()) / (item.minMinutes * 60_000)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

// ---------------------------------------------------------------------------
// S2d — new "Hôm nay" layout helpers (display only)
// ---------------------------------------------------------------------------

/**
 * The one task the screen suggests next: a running task first; then due homework
 * (overdue first), extras, and (on an empty day) an upcoming item to pick; then skills.
 * Both parts are open (R1), so skills come next as soon as Part 1 has nothing left to
 * suggest. Display only: the server still decides what may start.
 */
export function nextTask(state: DayState): TaskView | null {
  // R8a: a running "Làm thêm" run counts as running (shown with its Xong).
  const running = runningItems(state)[0];
  if (running) return running;
  return nextPart1(state, null) ?? state.part2.items.find((i) => i.state === "todo") ?? null;
}

/**
 * R6d (review): the Phần 1 task to suggest on the Học tập card — never a skill. A running
 * Phần 1 task; else, while Phần 1 is not complete, the first one in the child's own order
 * (plan keys), then due homework, then a supplementary task, then an upcoming one while the
 * "choose N" quota is open. Null when Phần 1 is complete (or nothing in it can be started).
 */
export function nextPart1(state: DayState, plan: readonly string[] | null): TaskView | null {
  const items = state.part1.items;
  const running = items.find((i) => i.state === "running");
  if (running) return running;
  if (state.part1.complete) return null;
  const todo = (i: TaskView) => i.state === "todo";
  const pickOpen = state.part1.pick.done < state.part1.pick.needed;
  for (const k of plan ?? []) {
    const i = items.find((x) => x.key === k);
    if (i && todo(i) && (i.group !== "upcoming" || pickOpen)) return i;
  }
  return (
    items.find((i) => i.group === "due" && todo(i)) ??
    items.find((i) => i.source === "template" && todo(i)) ??
    (pickOpen ? items.find((i) => i.group === "upcoming" && todo(i)) : undefined) ??
    null
  );
}

/** The group name shown on a task (same words on Hôm nay and in Góc học tập). */
export function groupLabel(i: TaskView): string {
  return i.source === "homework" ? (i.group === "upcoming" ? "Làm trước" : "Bài trên lớp") : i.part === 1 ? "Bài bổ sung" : "Kỹ năng";
}

/**
 * R6d: tasks of today still to do (Phần 1 + Phần 2) for "Còn N việc nữa là có giờ tự do".
 * Upcoming items and "đang xây" slots are not counted one by one; on a day with no due
 * homework the "choose N upcoming" quota still left is (the same slots `part1.total` counts),
 * so the number never says 0 while free time is still closed. Display only.
 */
export function leftCount(state: DayState): number {
  const open = [...state.part1.items, ...state.part2.items].filter((i) => i.group !== "upcoming" && !i.placeholder && i.state !== "done").length;
  return open + Math.max(0, state.part1.pick.needed - state.part1.pick.done);
}

/** Required tasks of the day (both parts) for the header ring. */
export function dayProgress(state: DayState): { done: number; total: number } {
  return { done: state.part1.done + state.part2.done, total: state.part1.total + state.part2.total };
}

/** How urgent a deadline is: drives the dot / chip colour. */
export function dueTone(dueDate: string, today: string): "urgent" | "soon" | "later" {
  if (dueDate <= today) return "urgent";
  if (dueDate === addDays(today, 1)) return "soon";
  return "later";
}

/** Last local date on which finishing still earns ★ sớm (interpretation 18), or null if too late. */
export function earlyUntil(dueDate: string, today: string): string | null {
  const last = addDays(dueDate, -2);
  return today <= last ? last : null;
}

/** Header pill: what the laptop does right now, in the child's words (never "Khóa"). */
export function statusPill(state: DayState, nowMs: number): { label: string; open: boolean } {
  const left = state.openUntil ? clock(new Date(state.openUntil).getTime() - nowMs) : "";
  switch (state.status) {
    case "BREAK":
      // R8b: the break countdown in whole minutes only (no seconds).
      return { label: `Giờ nghỉ · còn ${state.openUntil ? Math.max(0, Math.ceil((new Date(state.openUntil).getTime() - nowMs) / 60_000)) : 0} phút`, open: true };
    case "FREE":
      return { label: `Giờ tự do · còn ${left}`, open: true };
    case "OPEN_OVERRIDE":
      return { label: `Bố mẹ mở máy · còn ${left}`, open: true };
    case "OPEN_SICK":
      return { label: "Ngày ốm · mở mọi trang", open: true };
    case "OPEN_TRUST":
      return { label: "Tin tưởng · mở mọi trang", open: true };
    case "LOCK_END":
      return { label: "Hết giờ tự do · mai gặp lại", open: false };
    case "LOCK_OVERRIDE":
      return { label: "Bố mẹ tạm khóa · chỉ mở trang học", open: false };
    default:
      return { label: "Giờ học · máy chỉ mở trang học", open: false };
  }
}

/** A darker shade of the child's colour for the focus screen (keeps white text readable). */
export function shade(hex: string, factor = 0.45): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m?.[1]) return "#16243a";
  const n = parseInt(m[1], 16);
  const ch = (v: number) => Math.round(v * factor).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

/** "Thứ Bảy 17/10" style date for deadlines further out. */
export function dayMonth(date: string): string {
  return `${WEEKDAY_LONG[isoWeekday(date)]} ${date.slice(8, 10)}/${date.slice(5, 7)}`;
}
