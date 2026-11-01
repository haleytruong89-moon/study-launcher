import { describe, expect, it } from "vitest";
import { permanentProblem } from "@/lib/admin/allowlist";
import { normalizeDomain } from "@/lib/admin/schemas";
import { PRESETS } from "@/lib/admin/presets";
import { normalizeDomainList } from "@/extension/src/core/domains";

describe("Thêm nhanh bundles", () => {
  it("are valid, normal domains that may be allowed for good (never Search / YouTube)", () => {
    for (const p of PRESETS) {
      for (const d of p.domains) {
        expect(normalizeDomain(d)).toBe(d);
        expect(permanentProblem(d)).toBeNull();
      }
      // The extension keeps every one of them too (no single-label or odd entries).
      expect(normalizeDomainList([...p.domains])).toEqual([...p.domains].sort());
    }
  });

  it("cover Meet, NotebookLM and Google Docs/Drive/Forms", () => {
    const all = PRESETS.flatMap((p) => p.domains);
    for (const d of ["meet.google.com", "notebooklm.google.com", "docs.google.com", "drive.google.com", "forms.gle"]) expect(all).toContain(d);
    expect(all).not.toContain("google.com");
    expect(all).not.toContain("www.google.com");
  });
});
