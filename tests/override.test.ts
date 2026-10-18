import { describe, expect, it } from "vitest";
import { overrideRow } from "@/lib/admin/override";

const at = (t: string) => new Date(`2026-10-17T${t}+07:00`);
const iso = (t: string) => at(t).toISOString();
const MID = new Date("2026-10-18T00:00:00+07:00").toISOString();
const none = { openUntil: null, overrideActive: false };

describe("parent overrides (server clock, clipped at 00:00)", () => {
  it("open / lock for N minutes or until the end of today", () => {
    expect(overrideRow("open", 30, at("19:00"), none)).toEqual({ ok: true, row: { kind: "open_until", until: iso("19:30") } });
    expect(overrideRow("open", null, at("19:00"), none)).toEqual({ ok: true, row: { kind: "open_until", until: MID } });
    expect(overrideRow("lock", 60, at("23:30"), none)).toEqual({ ok: true, row: { kind: "lock_until", until: MID } });
  });

  it("extend adds minutes after the current open window (or now)", () => {
    expect(overrideRow("extend", 15, at("19:00"), { openUntil: iso("19:20"), overrideActive: false })).toEqual({ ok: true, row: { kind: "open_until", until: iso("19:35") } });
    expect(overrideRow("extend", 15, at("19:00"), { openUntil: iso("18:00"), overrideActive: false })).toEqual({ ok: true, row: { kind: "open_until", until: iso("19:15") } });
    expect(overrideRow("extend", 30, at("23:50"), none)).toEqual({ ok: true, row: { kind: "open_until", until: MID } });
    expect(overrideRow("extend", 15, at("19:00"), { openUntil: MID, overrideActive: true }).ok).toBe(false);
    expect(overrideRow("extend", null, at("19:00"), none).ok).toBe(false);
  });

  it("clear writes an already-expired row (only when an override is active)", () => {
    expect(overrideRow("clear", null, at("19:00"), { openUntil: iso("20:00"), overrideActive: true })).toEqual({ ok: true, row: { kind: "open_until", until: iso("19:00") } });
    expect(overrideRow("clear", null, at("19:00"), none).ok).toBe(false);
  });

  it("refuses odd minutes", () => {
    expect(overrideRow("open", 0, at("19:00"), none).ok).toBe(false);
    expect(overrideRow("open", 2.5, at("19:00"), none).ok).toBe(false);
  });
});
