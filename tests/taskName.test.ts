import { describe, expect, it } from "vitest";
import { isExamPrep, nameParts, taskName, withExamPrefix } from "@/lib/today/taskName";

const tpl = (title: string, subject: string | null, part: 1 | 2 = 1) => ({ source: "template" as const, part, title, subject });

describe("taskName (parent comment 21/11/2026: the subject first)", () => {
  it("a set task reads subject · title; homework keeps its title", () => {
    expect(taskName(tpl("Practice", "English"))).toBe("English · Practice");
    expect(nameParts(tpl("Practice", "Math"))).toEqual({ subject: "Math", rest: "Practice" });
    expect(taskName({ source: "homework", part: 1, title: "Ngữ văn", subject: "Ngữ văn" })).toBe("Ngữ văn");
  });

  it("no repeated subject, no empty parts", () => {
    expect(taskName(tpl("Toán", "toán"))).toBe("Toán");
    expect(taskName(tpl("Đọc sách", null, 2))).toBe("Đọc sách");
    expect(taskName(tpl("Đọc sách", "  ", 2))).toBe("Đọc sách");
  });

  it("“Ôn thi …” marks an exam-prep bài bổ sung and is not repeated in the name", () => {
    expect(isExamPrep(tpl("Ôn thi · Hàm số", "Toán"))).toBe(true);
    expect(isExamPrep(tpl("ôn thi: Unit 5", "Tiếng Anh"))).toBe(true);
    expect(isExamPrep(tpl("ÔN THI", "Ngữ văn"))).toBe(true);
    expect(isExamPrep(tpl("Ôn thi".normalize("NFD") + " - Văn nghị luận", "Ngữ văn"))).toBe(true);
    expect(taskName(tpl("Ôn thi · Hàm số", "Toán"))).toBe("Toán · Hàm số");
    expect(taskName(tpl("Ôn thi", "Ngữ văn"))).toBe("Ngữ văn");
    // Not exam prep: a skill, homework, or a word that only starts the same way.
    expect(isExamPrep(tpl("Ôn thi · Hàm số", "Toán", 2))).toBe(false);
    expect(isExamPrep({ source: "homework", part: 1, title: "Ôn thi", subject: "Ôn thi" })).toBe(false);
    expect(isExamPrep(tpl("Ôn thịt", "Toán"))).toBe(false);
    expect(isExamPrep(tpl("Practice", "Math"))).toBe(false);
  });

  it("the parent's tick adds and removes the prefix", () => {
    expect(withExamPrefix("Hàm số", true)).toBe("Ôn thi · Hàm số");
    expect(withExamPrefix("Ôn thi · Hàm số", false)).toBe("Hàm số");
    expect(withExamPrefix("Ôn thi · Hàm số", true)).toBe("Ôn thi · Hàm số");
    expect(withExamPrefix("", true)).toBe("Ôn thi");
  });
});
