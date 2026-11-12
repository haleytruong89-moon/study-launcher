import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRESETS } from "@/lib/admin/presets";

// Migration 0016 opens the "Thêm nhanh" bundles by default; its lists must match the presets.
const sql = readFileSync("supabase/migrations/0016_default_study_sites.sql", "utf8");
const code = sql.replace(/--[^\n]*/g, "");

describe("0016 default study sites", () => {
  const presetDomains = [...new Set(PRESETS.flatMap((p) => p.domains))].sort();

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
