import { describe, expect, it } from "vitest";
import { domainFromInput } from "@/lib/admin/allowlist";
import { blockDomain, blockDomainProblem, isBlockedHost } from "@/lib/admin/blocklist";

const LAUNCHER = "study-launcher-nine.vercel.app";

describe("Luôn chặn (V1)", () => {
  it("a normal site may be blocked", () => {
    expect(blockDomainProblem("grok.com", LAUNCHER)).toBeNull();
    expect(blockDomainProblem("archiveofourown.org", null)).toBeNull();
  });

  it("the Launcher itself, its parent domain and Google sign-in may not", () => {
    expect(blockDomainProblem(LAUNCHER, LAUNCHER)).toMatch(/Study Launcher/);
    expect(blockDomainProblem("supabase.co", LAUNCHER, "abcd.supabase.co")).toMatch(/Study Launcher/);
    expect(blockDomainProblem("gstatic.com", LAUNCHER)).toMatch(/đăng nhập/);
    expect(blockDomainProblem("googleapis.com", LAUNCHER)).toMatch(/đăng nhập/);
    expect(blockDomainProblem("vercel.app", LAUNCHER)).toMatch(/Study Launcher/);
    expect(blockDomainProblem("accounts.google.com", LAUNCHER)).toMatch(/đăng nhập/);
    expect(blockDomainProblem("google.com", LAUNCHER)).toMatch(/đăng nhập/);
  });

  it("what the parent types is normalised first; garbage is refused", () => {
    expect(domainFromInput("https://www.Grok.com/chat")).toEqual({ ok: true, domain: "www.grok.com" });
    expect(domainFromInput("not a domain").ok).toBe(false);
  });

  it("sub-domains are blocked, look-alikes are not", () => {
    expect(isBlockedHost("beta.character.ai", ["character.ai"])).toBe(true);
    expect(isBlockedHost("character.ai", ["character.ai"])).toBe(true);
    expect(isBlockedHost("notcharacter.ai", ["character.ai"])).toBe(false);
    expect(isBlockedHost("docs.google.com", [])).toBe(false);
  });

  it("a pasted www link blocks the whole site", () => {
    expect(blockDomain("www.character.ai")).toBe("character.ai");
    expect(blockDomain("character.ai")).toBe("character.ai");
    expect(blockDomain("beta.character.ai")).toBe("beta.character.ai");
    expect(blockDomain("www.com")).toBe("www.com");
  });
});
