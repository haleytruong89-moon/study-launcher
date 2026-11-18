import { describe, expect, it } from "vitest";
import { DOSSIERS, deckPool, nextUnseen, pickDossier } from "@/lib/binhYen/dossier";
import { FIELD_NOTES, brainCard } from "@/lib/binhYen/fieldNotes";

const pool = [{ key: "a" }, { key: "b" }, { key: "c" }];

describe("Góc bình yên: a different card each time (18/11/2026)", () => {
  it("nextUnseen: from the start, skipping cards seen today; all seen → the start again", () => {
    expect(nextUnseen(pool, 0, new Set())).toBe(0);
    expect(nextUnseen(pool, 4, new Set())).toBe(1);
    expect(nextUnseen(pool, 1, new Set(["b"]))).toBe(2);
    expect(nextUnseen(pool, 2, new Set(["c", "a"]))).toBe(1);
    expect(nextUnseen(pool, 2, new Set(["a", "b", "c"]))).toBe(2);
    expect(nextUnseen(pool, -1, new Set())).toBe(2);
    expect(nextUnseen([], 3, new Set())).toBe(-1);
  });

  it("pressing 'Một điều khác' walks the whole topic before any repeat", () => {
    const deck = deckPool(FIELD_NOTES, "green", "dong_vat");
    expect(deck.length).toBeGreaterThan(2);
    const seen = new Set<string>();
    let at = 7;
    for (let i = 0; i < deck.length; i++) {
      const idx = nextUnseen(deck, at, seen);
      const key = deck[idx]!.key;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      at = idx + 1;
    }
    expect(seen.size).toBe(deck.length);
  });

  it("deckPool is the pool the daily pick uses", () => {
    const deck = deckPool(DOSSIERS, "red", "nao");
    expect(deck).toContain(pickDossier(DOSSIERS, "2026-11-18", "red", "nao"));
    expect(deck.every((d) => !d.held && d.topic === "nao")).toBe(true);
  });

  it("brainCard: a brain / feelings card suiting the quad, varying with the seed", () => {
    const seen = new Set<string>();
    for (let n = 0; n < 20; n++) {
      const c = brainCard("yellow", n);
      expect(c).not.toBeNull();
      expect(["bo_nao", "cam_xuc"]).toContain(c!.topic);
      expect(c!.quads.length === 0 || c!.quads.includes("yellow")).toBe(true);
      seen.add(c!.key);
    }
    expect(seen.size).toBeGreaterThan(2);
    for (const q of ["red", "blue", "yellow", "green"] as const) expect(brainCard(q, 3)).not.toBeNull();
  });
});
