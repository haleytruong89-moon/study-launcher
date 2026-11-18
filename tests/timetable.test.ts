import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dayPlan, nextClassDate, nextSchoolDay, normTime, parseQuick, subjectKey, toQuick, versionOn, type TimetableVersion } from "@/lib/timetable/rules";

const text6 = readFileSync("tests/fixtures/tkb-6a.txt", "utf8");
const text9 = readFileSync("tests/fixtures/tkb-9a.txt", "utf8");

function version(text: string, validFrom: string, id = validFrom): TimetableVersion {
  const r = parseQuick(text);
  if (!r.ok) throw new Error(r.errors.join("; "));
  return { ...r.data, id, childId: "kid", validFrom };
}

describe("Thời khóa biểu (18/11/2026)", () => {
  it("reads the quick text of both classes", () => {
    const a = version(text6, "2026-11-09");
    expect(a.label).toBe("6A6");
    expect(a.periods).toHaveLength(29);
    expect(a.times.am?.["1"]).toBe("07:30-08:15");
    expect(a.times.pm?.["2"]).toBe("13:50-14:35");
    expect(a.uniform["3"]).toMatch(/^Áo trắng/);
    const b = version(text9, "2026-11-09");
    expect(b.periods).toHaveLength(29);
    expect(b.periods.filter((p) => p.day === 6).map((p) => p.subject)).toEqual(["Văn", "Văn", "Thể dục", "Hóa", "Sinh hoạt"]);
  });

  it("writes back what it read (the editor starts from it)", () => {
    const a = version(text6, "2026-11-09");
    const again = parseQuick(toQuick(a));
    expect(again.ok && again.data).toEqual({ label: a.label, note: a.note, periods: a.periods, times: a.times, uniform: a.uniform });
  });

  it("says what is wrong, with the line", () => {
    const r = parseQuick("S1 7h30-8h15 | Toán |\nS1 | Văn |\nS9 | x |\nxin chào\nS2 25:00-26:00 | Văn |");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toEqual(["Dòng 2: tiết S1 bị lặp", "Dòng 3: tiết phải từ 1 đến 6", 'Dòng 4: không hiểu "xin chào"', 'Dòng 5: giờ "25:00-26:00" chưa đúng (vd 07:30-08:15)']);
    }
    expect(parseQuick("LỚP: 6A6").ok).toBe(false);
    expect(normTime("7h30 - 8h15")).toBe("07:30-08:15");
    expect(normTime("9:00-8:00")).toBeNull();
  });

  it("the version in force: the latest that started on or before the day", () => {
    const vs = [version(text6, "2026-11-09", "old"), version(text9, "2027-02-01", "new")];
    expect(versionOn(vs, "2026-11-08")).toBeNull();
    expect(versionOn(vs, "2026-11-18")?.id).toBe("old");
    expect(versionOn(vs, "2027-02-01")?.id).toBe("new");
  });

  it("a day's lessons with times, its uniform; Sunday has none", () => {
    const vs = [version(text6, "2026-11-09")];
    const wed = dayPlan(vs, "2026-11-18")!;
    expect(wed.weekday).toBe(3);
    expect(wed.periods.map((p) => p.subject)).toEqual(["KHTN(S)", "HĐTNHN/CĐ", "LS&ĐL(LS)", "ANH", "Tin"]);
    expect(wed.periods[0]?.time).toBe("07:30-08:15");
    expect(wed.uniform).toMatch(/^Áo trắng/);
    const mon = dayPlan(vs, "2026-11-16")!;
    expect(mon.periods.filter((p) => p.session === "pm").map((p) => p.subject)).toEqual(["LS&ĐL(ĐL)", "ANH"]);
    expect(dayPlan(vs, "2026-11-22")).toBeNull();
  });

  it("the next school day skips the weekend when Saturday is empty", () => {
    const six = [version(text6, "2026-11-09")];
    expect(nextSchoolDay(six, "2026-11-20")?.date).toBe("2026-11-23");
    const nine = [version(text9, "2026-11-09")];
    expect(nextSchoolDay(nine, "2026-11-20")?.date).toBe("2026-11-21");
  });

  it("Giao bài: due on the next lesson of the subject", () => {
    const six = [version(text6, "2026-11-09")];
    // Tuesday 17/11 evening, Toán → Thursday 19/11 (Wednesday has no Toán).
    expect(nextClassDate(six, "Toán", "2026-11-17")).toBe("2026-11-19");
    expect(nextClassDate(six, "Tiếng Anh", "2026-11-17")).toBe("2026-11-18");
    expect(nextClassDate(six, "KHTN", "2026-11-18")).toBe("2026-11-20");
    expect(nextClassDate(six, "Lịch sử", "2026-11-18")).toBe("2026-11-19");
    expect(nextClassDate(six, "Bơi", "2026-11-18")).toBeNull();
    const nine = [version(text9, "2026-11-09")];
    expect(nextClassDate(nine, "Hóa", "2026-11-17")).toBe("2026-11-21");
    expect(subjectKey("Ngữ văn")).toBe("van");
    expect(subjectKey("ANH")).toBe("anh");
    expect(subjectKey("KHTN(L)")).toBe("khtn");
  });
});
