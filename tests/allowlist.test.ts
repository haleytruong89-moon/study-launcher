import { describe, expect, it } from "vitest";
import { baseDomain, domainFromInput, expiresAt, permanentProblem, wideDomainOffer } from "@/lib/admin/allowlist";
import { safeNext } from "@/lib/safe-next";

const at = (t: string) => new Date(`2026-10-18T${t}+07:00`);
const MID = new Date("2026-10-19T00:00:00+07:00").toISOString();

describe("allowlist helpers", () => {
  it("accepts a domain or a full link", () => {
    expect(domainFromInput("meet.google.com")).toEqual({ ok: true, domain: "meet.google.com" });
    expect(domainFromInput("https://NotebookLM.google.com/notebook/abc?x=1")).toEqual({ ok: true, domain: "notebooklm.google.com" });
    expect(domainFromInput("not a domain").ok).toBe(false);
  });

  it("expiry on the server clock, clipped at 00:00", () => {
    expect(expiresAt("permanent", at("20:00"))).toBeNull();
    expect(expiresAt("today", at("20:00"))).toBe(MID);
    expect(expiresAt("15m", at("20:00"))).toBe(at("20:15").toISOString());
    expect(expiresAt("15m", at("23:55"))).toBe(MID);
  });

  it("never allows Google Search / YouTube for good", () => {
    expect(permanentProblem("youtube.com")).not.toBeNull();
    expect(permanentProblem("google.com")).not.toBeNull();
    expect(permanentProblem("x.translate.goog")).not.toBeNull();
    expect(permanentProblem("music.youtube.com")).not.toBeNull();
    expect(permanentProblem("meet.google.com")).toBeNull();
  });

  it("offers the whole domain for good, never a forbidden one", () => {
    expect(baseDomain("redirect.zalo.me")).toBe("zalo.me");
    expect(baseDomain("chat.zalo.me")).toBe("zalo.me");
    expect(baseDomain("zalo.me")).toBe("zalo.me");
    expect(baseDomain("thcs.hanoi.edu.vn")).toBe("hanoi.edu.vn");
    expect(baseDomain("www.abc.com.vn")).toBe("abc.com.vn");
    expect(wideDomainOffer("redirect.zalo.me")).toBe("zalo.me");
    expect(wideDomainOffer("zalo.me")).toBeNull(); // already the whole domain
    expect(wideDomainOffer("meet.google.com")).toBeNull(); // google.com never
    expect(wideDomainOffer("music.youtube.com")).toBeNull();
    expect(wideDomainOffer("someone.vercel.app")).toBeNull(); // shared hosting
    expect(wideDomainOffer("abc.com.vn")).toBeNull();
    expect(wideDomainOffer("x.translate.goog")).toBeNull();
  });

  it("login only returns to our own pages", () => {
    expect(safeNext("/ghep-may")).toBe("/ghep-may");
    expect(safeNext("//evil.com")).toBeNull();
    expect(safeNext("https://evil.com")).toBeNull();
    expect(safeNext("/\\evil.com")).toBeNull();
    expect(safeNext(undefined)).toBeNull();
  });
});
