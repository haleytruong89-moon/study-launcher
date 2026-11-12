import { describe, expect, it } from "vitest";
import { allowDomainsFor, extStateBody } from "@/lib/ext/payload";
import { parseExtStatePayload } from "../extension/src/core/sync";
import { computeDayState, type DayInput } from "@/lib/dayState";

const KID = "11111111-1111-4111-8111-111111111111";
const SIB = "22222222-2222-4222-8222-222222222222";
const now = new Date("2026-10-17T19:00:00+07:00");

describe("allowlist sent to the extension", () => {
  it("family + own rows, not expired; active non-placeholder slots; deep links; never a sibling's", () => {
    const d = allowDomainsFor(
      KID,
      now,
      [
        { domain: "https://Tratu.Soha.vn/path", childId: null, expiresAt: null },
        { domain: "olm.vn", childId: KID, expiresAt: null },
        { domain: "sibling.vn", childId: SIB, expiresAt: null },
        { domain: "old.vn", childId: KID, expiresAt: "2026-10-17T11:00:00Z" },
        { domain: "later.vn", childId: KID, expiresAt: "2026-10-17T13:00:00Z" },
      ],
      [
        { childId: KID, url: "https://hoc.example.com/x", allowDomains: ["cdn.example.com"], active: true, kind: "external" },
        { childId: null, url: "https://math-app-gules.vercel.app", allowDomains: [], active: true, kind: "internal" },
        { childId: KID, url: "https://off.example.com", allowDomains: [], active: false, kind: "external" },
        { childId: KID, url: "https://building.example.com", allowDomains: [], active: true, kind: "placeholder" },
        { childId: SIB, url: "https://sib.example.com", allowDomains: [], active: true, kind: "external" },
      ],
      ["https://deep.example.org/lesson/1", null],
    );
    expect(d).toEqual(["cdn.example.com", "deep.example.org", "hoc.example.com", "later.vn", "math-app-gules.vercel.app", "olm.vn", "tratu.soha.vn"]);
  });

  it("the body is accepted by the extension's own parser", () => {
    const input: DayInput = {
      settings: { breakMinutes: 10, freeMinutes: 45, extraMinMinutes: 20, skillMinMinutes: 20, passesPerWeek: 1, trustUpPct: 90, trustUpWeeks: 3, trustDownPct: 70, homeworkLookaheadDays: 1, homeworkMinUpcoming: 1 },
      bedtime: "21:30",
      trustMode: "lock",
      sessions: [],
      homework: [],
      templates: [],
      appSlots: [],
      runs: [],
      overrides: [],
      breaks: [],
    };
    const s = computeDayState(input, now);
    const body = extStateBody(s, ["olm.vn"], "https://study-launcher-nine.vercel.app");
    const parsed = parseExtStatePayload(JSON.parse(JSON.stringify(body)));
    expect(parsed).not.toBeNull();
    expect(parsed?.open).toBe(false); // empty day: break offer is still locked
    expect(parsed?.blockAlways).toContain("translate.goog");
    expect(parsed?.pollSeconds).toBe(30);
  });
});
