import { describe, expect, it } from "vitest";
import { LINE, SFX, TONE, comicCover, comicPage, comicPages, dayLabelVi, panelLabel } from "@/lib/comic/model";
import type { WeekDay } from "@/lib/today/weekDays";

const day = (date: string, o: Partial<WeekDay> = {}): WeekDay => ({ date, future: false, feel: null, study: false, skill: false, play: false, ...o });
const ctx = { today: "2026-11-05", byEnabled: true, skillTitleToday: "Đọc sách", freeMinutes: 45, playPlan: (d: string) => (d === "2026-11-03" ? "Vẽ / cosplay" : null) };

describe("comic constants (spec R5, verbatim from the artifact)", () => {
  it("two lines, one sfx and one tone per region", () => {
    expect(LINE.red).toEqual(["Khoan… chưa kết luận vội!", "Hừm. Hồ sơ này nóng quá."]);
    expect(LINE.green[1]).toBe("Một ngày dịu dàng.");
    expect(SFX).toEqual({ red: "GRRR!", yellow: "YAY!", blue: "hừm…", green: "~ phù ~" });
    expect(TONE.blue).toBe("#DCE5F3");
  });
});

describe("comic page", () => {
  it("labels", () => {
    expect(dayLabelVi("2026-11-02")).toBe("Thứ Hai · 02/11");
    expect(dayLabelVi("2026-11-08")).toBe("Chủ nhật · 08/11");
  });

  it("a full past day", () => {
    const p = comicPage(day("2026-11-03", { feel: { quad: "yellow", word: "vui", label: "vui", activity: "breath" }, study: true, skill: true, play: true }), 1, ctx);
    expect(p.label).toBe("Thứ Ba · 03/11");
    const [A, B, C, D, E] = p.panels;
    expect(A).toMatchObject({ kind: "feel", quad: "yellow", line: "Manh mối tốt đây rồi!", sfx: "YAY!", expr: "smile", speed: true, tone: "#F7ECCB", cap: "Thứ Ba · 03/11", word: "vui" });
    expect(A && "box" in A ? A.box : "").toBe("Hồ sơ vàng · vui");
    expect(B).toMatchObject({ kind: "act", emoji: "🌬️", box: "Thở cho dịu lại", cap: "Cách xử lý" });
    expect(C).toMatchObject({ kind: "done", emoji: "📚", box: "Bài hôm nay ✓", sfx: "XONG!", cap: "Nhiệm vụ học" });
    expect(D).toMatchObject({ kind: "done", emoji: "📖", box: "Kỹ năng ✓", sfx: null, cap: "Kỹ năng" });
    expect(E).toMatchObject({ kind: "play", box: "Vẽ / cosplay", line: "Yeah!", expr: "smile", cap: "Giờ tự do" });
  });

  it("the line alternates with the page index; blue and green have no speed lines", () => {
    const blue = (i: number) => comicPage(day("2026-11-02", { feel: { quad: "blue", word: "met", label: "mệt", activity: null } }), i, ctx).panels[0];
    expect(blue(0)).toMatchObject({ line: "Pin yếu rồi… nghỉ chút đã.", speed: false, expr: "sad", sfx: "hừm…" });
    expect(blue(1)).toMatchObject({ line: "Hôm nay hơi nặng nề." });
    expect(blue(2)).toMatchObject({ line: "Pin yếu rồi… nghỉ chút đã." });
    expect(comicPage(day("2026-11-02", { feel: { quad: "red", word: "lo_lang", label: "lo lắng", activity: null } }), 0, ctx).panels[0]).toMatchObject({ speed: true, expr: "angry", box: "Hồ sơ đỏ · lo lắng" });
  });

  it("feeling without activity → 'Gọi tên là đủ'", () => {
    const p = comicPage(day("2026-11-02", { feel: { quad: "green", word: "binh_yen", label: "bình yên", activity: null } }), 0, ctx);
    expect(p.panels[0]).toMatchObject({ kind: "feel", box: "Hồ sơ lục · bình yên", expr: "calm" });
    expect(p.panels[1]).toMatchObject({ kind: "act", emoji: "📝", box: "Gọi tên là đủ cho hôm nay" });
  });

  it("an unknown activity key counts as none; an unknown word label falls back", () => {
    const p = comicPage(day("2026-11-02", { feel: { quad: "green", word: "gone", label: "", activity: "no_such_thing" } }), 0, ctx);
    expect(p.panels[0]).toMatchObject({ box: "Hồ sơ lục · Góc bình yên" });
    expect(p.panels[1]).toMatchObject({ kind: "act", emoji: "📝" });
  });

  it("empty past day: calm copy", () => {
    const p = comicPage(day("2026-11-02"), 0, ctx);
    expect(p.panels.map((x) => (x.kind === "empty" ? x.hint : x.kind))).toEqual(["Khung mở đầu: ghé Góc bình yên để vẽ", "chưa vẽ", "hôm nay chưa xong — không sao", "nghỉ", "—"]);
    expect(p.panels[0]).toMatchObject({ cap: "Thứ Hai · 02/11" });
  });

  it("today: 'đang làm…' and the skill title", () => {
    const p = comicPage(day("2026-11-05", { skill: true }), 3, ctx);
    expect(p.panels[2]).toMatchObject({ kind: "empty", hint: "đang làm…" });
    expect(p.panels[3]).toMatchObject({ kind: "done", box: "Đọc sách ✓" });
    expect(p.panels[4]).toMatchObject({ kind: "empty", hint: "xong hết là có" });
    expect(comicPage(day("2026-11-05"), 3, ctx).panels[3]).toMatchObject({ kind: "empty", hint: "đang làm…" });
  });

  it("free time without a plan on this browser: the minutes", () => {
    const p = comicPage(day("2026-11-04", { play: true }), 2, ctx);
    expect(p.panels[4]).toMatchObject({ kind: "play", box: "45 phút tự do" });
  });

  it("Góc bình yên off: panel A shows the date only", () => {
    const p = comicPage(day("2026-11-02"), 0, { ...ctx, byEnabled: false });
    expect(p.panels[0]).toMatchObject({ kind: "empty", hint: "", cap: "Thứ Hai · 02/11" });
  });

  it("future days are not pages; cover lists the pages", () => {
    const days = [day("2026-11-02", { feel: { quad: "red", word: "lo_lang", label: "lo lắng", activity: null } }), day("2026-11-04"), day("2026-11-05"), { ...day("2026-11-06"), future: true }];
    const pages = comicPages(days, ctx);
    expect(pages.map((p) => p.date)).toEqual(["2026-11-02", "2026-11-04", "2026-11-05"]);
    expect(comicCover(pages, days, "2026-11-05")).toEqual([
      { page: 1, weekday: "Thứ Hai", short: "T2", emoji: expect.any(String), word: "lo lắng" },
      { page: 2, weekday: "Thứ Tư", short: "T4", emoji: "·", word: "" },
      { page: 3, weekday: "Thứ Năm", short: "T5", emoji: "·", word: "đang vẽ" },
    ]);
    expect(comicCover(pages, days, "2026-11-05")[0]?.emoji).not.toBe("·");
  });

  it("the page index drives the line (Monday = 0 even when a day is missing)", () => {
    const days = [day("2026-11-02"), day("2026-11-03", { feel: { quad: "yellow", word: "vui", label: "vui", activity: null } })];
    expect(comicPages(days, ctx)[1]?.panels[0]).toMatchObject({ line: LINE.yellow[1] });
  });

  it("panel labels for screen readers read the content, never more", () => {
    const p = comicPage(day("2026-11-03", { feel: { quad: "yellow", word: "vui", label: "vui", activity: null }, study: true }), 1, ctx);
    expect(panelLabel(p.panels[0]!)).toBe("Thứ Ba · 03/11: Manh mối tốt đây rồi! Hồ sơ vàng · vui");
    expect(panelLabel(p.panels[2]!)).toBe("Nhiệm vụ học: Bài hôm nay ✓");
    expect(panelLabel(p.panels[3]!)).toBe("Kỹ năng: nghỉ");
    expect(panelLabel(comicPage(day("2026-11-02"), 0, { ...ctx, byEnabled: false }).panels[0]!)).toBe("Thứ Hai · 02/11");
  });
});
