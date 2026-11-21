import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dayPlan, nextClassDate, nextSchoolDay, normTime, parseQuick, subjectKey, toQuick, uniformFor, validateData, versionOn, type TimetableVersion } from "@/lib/timetable/rules";

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

const nguyen = (periods: { day: number; subject: string }[]): TimetableVersion => ({
  id: "v",
  childId: "c",
  validFrom: "2026-11-09",
  label: "9A13",
  note: "",
  periods: periods.map((p, i) => ({ day: p.day, session: "am", n: (i % 5) + 1, subject: p.subject })),
  times: {},
  uniform: { "1": "Áo đồng phục lớp", "2": "Áo trắng", "3": "Áo trắng", "4": "Áo trắng", "5": "Áo đồng phục lớp", "6": "Áo trắng", pe: "Đồng phục thể dục (áo xanh lá)" },
});

describe("uniform rule (21/11/2026)", () => {
  it("a day with Thể dục wears the PE uniform, else the weekday text", () => {
    const v = nguyen([{ day: 3, subject: "Thể dục" }, { day: 2, subject: "Hóa" }, { day: 6, subject: "Thể dục" }]);
    expect(uniformFor(v, 3)).toBe("Đồng phục thể dục (áo xanh lá)");
    expect(uniformFor(v, 2)).toBe("Áo trắng");
    expect(uniformFor(v, 6)).toBe("Đồng phục thể dục (áo xanh lá)");
    expect(uniformFor(v, 1)).toBe("Áo đồng phục lớp");
    expect(uniformFor(v, 7)).toBeNull();
  });
  it("PE wins even on a class-uniform day; GDTC counts as Thể dục", () => {
    expect(uniformFor(nguyen([{ day: 1, subject: "GDTC" }]), 1)).toBe("Đồng phục thể dục (áo xanh lá)");
  });
  it("without a pe key the weekday text stays (An)", () => {
    const v = { ...nguyen([{ day: 1, subject: "GDTC" }]), uniform: { "1": "Áo polo đỏ, quần thể thao" } };
    expect(uniformFor(v, 1)).toBe("Áo polo đỏ, quần thể thao");
  });
  it("dayPlan uses the rule", () => {
    expect(dayPlan([nguyen([{ day: 3, subject: "Thể dục" }])], "2026-11-25")?.uniform).toBe("Đồng phục thể dục (áo xanh lá)");
  });
  it("quick text round-trips the PE line", () => {
    const r = parseQuick("S1 07:30-08:15 | Toán | | Thể dục | | |\nĐỒNG PHỤC THỂ DỤC: Áo xanh lá");
    expect(r.ok && r.data.uniform.pe).toBe("Áo xanh lá");
    expect(r.ok && toQuick(r.data)).toContain("ĐỒNG PHỤC THỂ DỤC: Áo xanh lá");
  });
});

describe("subject groups (21/11/2026)", () => {
  it("folds the school names together", () => {
    expect(subjectKey("GDTC")).toBe("the duc");
    expect(subjectKey("Thể dục")).toBe("the duc");
    expect(subjectKey("NT(MT)")).toBe("my thuat");
    expect(subjectKey("Mỹ thuật")).toBe("my thuat");
    expect(subjectKey("NT(AN)")).toBe("am nhac");
    expect(subjectKey("Nhạc")).toBe("am nhac");
  });
});

describe("validateData (the child's editor sends JSON)", () => {
  const ok = { label: "9A13", note: "", periods: [{ day: 1, session: "am", n: 1, subject: "Toán" }], times: { am: { "1": "07:30-08:15" } }, uniform: { "1": "Áo lớp", pe: "Áo xanh" } };
  it("accepts a clean version", () => expect(validateData(ok)).toEqual({ ok: true, data: ok }));
  it("rejects a duplicate period", () => {
    expect(validateData({ ...ok, periods: [...ok.periods, { day: 1, session: "am", n: 1, subject: "Văn" }] }).ok).toBe(false);
  });
  it("rejects a bad time, a long subject, an unknown uniform key, a bad day", () => {
    expect(validateData({ ...ok, times: { am: { "1": "7h" } } }).ok).toBe(false);
    expect(validateData({ ...ok, periods: [{ day: 1, session: "am", n: 1, subject: "x".repeat(31) }] }).ok).toBe(false);
    expect(validateData({ ...ok, uniform: { "9": "x" } }).ok).toBe(false);
    expect(validateData({ ...ok, periods: [{ day: 7, session: "am", n: 1, subject: "Toán" }] }).ok).toBe(false);
    expect(validateData(null).ok).toBe(false);
  });
});
