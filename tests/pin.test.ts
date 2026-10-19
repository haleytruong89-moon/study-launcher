import { describe, expect, it, vi } from "vitest";
import { pinProblem, wrongPinMessage } from "@/lib/pin/rules";

vi.mock("server-only", () => ({}));

describe("child PIN", () => {
  it("accepts 6 digits that are not trivially guessable", () => {
    expect(pinProblem("482916")).toBeNull();
    expect(pinProblem("048291")).toBeNull();
    expect(pinProblem("12345")).not.toBeNull();
    expect(pinProblem("12a456")).not.toBeNull();
    expect(pinProblem("111111")).toContain("giống nhau");
    expect(pinProblem("123456")).toContain("liền nhau");
    expect(pinProblem("987654")).toContain("liền nhau");
  });

  it("tells how many tries are left, then the lock", () => {
    expect(wrongPinMessage(1)).toBe("PIN chưa đúng. Còn 4 lần thử.");
    expect(wrongPinMessage(5)).toContain("Đợi 15 phút");
  });

  it("stores only a salted hash and checks it", async () => {
    const { hashPin, verifyPin } = await import("@/lib/pin/hash");
    const a = await hashPin("482916");
    const b = await hashPin("482916");
    expect(a).not.toContain("482916");
    expect(a).not.toBe(b); // salted
    expect(await verifyPin("482916", a)).toBe(true);
    expect(await verifyPin("482917", a)).toBe(false);
    expect(await verifyPin("482916", null)).toBe(false);
    expect(await verifyPin("482916", "garbage")).toBe(false);
  });
});
