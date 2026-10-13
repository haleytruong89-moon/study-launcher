import { describe, expect, it } from "vitest";
import { childEmail, generatePassword, slugify } from "@/lib/children";

describe("slugify", () => {
  it("removes Vietnamese diacritics", () => {
    expect(slugify("Hạnh Nguyên")).toBe("hanh-nguyen");
    expect(slugify("Đăng An")).toBe("dang-an");
  });

  it("falls back when nothing usable is left", () => {
    expect(slugify("!!!")).toBe("child");
  });
});

describe("childEmail", () => {
  it("builds an ASCII e-mail on the configured domain", () => {
    expect(childEmail("Đăng An", "study-launcher.local", "abc123")).toBe("dang-an-abc123@study-launcher.local");
  });
});

describe("generatePassword", () => {
  it("is long and different every time", () => {
    const a = generatePassword();
    const b = generatePassword();
    expect(a.length).toBeGreaterThanOrEqual(24);
    expect(a).not.toBe(b);
  });
});
