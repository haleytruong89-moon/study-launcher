import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRESETS } from "@/lib/admin/presets";

// Migration 0016 opens the "Thêm nhanh" bundles by default; its lists must match the presets.
const sql = readFileSync("supabase/migrations/0016_default_study_sites.sql", "utf8");
const code = sql.replace(/--[^\n]*/g, "");

describe("0016 default study sites", () => {
  // Spotify (V1, 27/11/2026) is opened by 0031, not 0016.
  const presetDomains = [...new Set(PRESETS.filter((p) => p.id !== "spotify").flatMap((p) => p.domains))].sort();

  it("adds every preset domain for new families (seed) and existing families", () => {
    const seed = sql.slice(sql.indexOf("-- 1. New families"), sql.indexOf("-- 2. Existing families"));
    const existing = sql.slice(sql.indexOf("-- 2. Existing families"), sql.indexOf("-- 3. Local"));
    for (const d of presetDomains) {
      expect(seed).toContain(`('${d}',`);
      expect(existing).toContain(`('${d}')`);
    }
  });

  it("never opens Google Search or YouTube", () => {
    expect(code).not.toMatch(/'(www\.)?google\.com'/);
    expect(code).not.toMatch(/youtube/i);
  });

  it("keeps Zalo as one whole-domain entry", () => {
    expect(PRESETS.find((p) => p.id === "zalo")?.domains).toEqual(["zalo.me"]);
  });
});

describe("0031 Spotify + always-block defaults", () => {
  const sql31 = readFileSync("supabase/migrations/0031_always_block.sql", "utf8");
  const seed = sql31.slice(sql31.indexOf("-- 3. New families"), sql31.indexOf("-- 4. Spotify"));

  it("opens spotify.com for new and existing families, as the preset does", () => {
    expect(PRESETS.find((p) => p.id === "spotify")?.domains).toEqual(["spotify.com"]);
    expect(seed).toContain("'spotify.com'");
    expect(sql31.slice(sql31.indexOf("-- 4. Spotify"))).toContain("'spotify.com'");
    expect(sql31.replace(/--[^\n]*/g, "")).not.toMatch(/youtube/i);
  });

  it("blocks the six D11/D16 sites for new and existing families", () => {
    const existing = sql31.slice(sql31.indexOf("-- 2. Existing families"), sql31.indexOf("-- 3. New families"));
    for (const d of ["character.ai", "c.ai", "janitorai.com", "grok.com", "archiveofourown.org", "ao3.org"]) {
      expect(seed).toContain(`('${d}')`);
      expect(existing).toContain(`('${d}')`);
    }
  });
});
