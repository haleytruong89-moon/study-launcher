import { describe, expect, it } from "vitest";
import { DEFAULT_TAB, tabHref } from "@/lib/childTabs";

describe("child tabs (21/11/2026: the laptop opens on Góc học tập)", () => {
  it("/today is Góc học tập; Hôm nay has its own address", () => {
    expect(DEFAULT_TAB).toBe("hoc-tap");
    expect(tabHref("hoc-tap")).toBe("/today");
    expect(tabHref("hom-nay")).toBe("/today?tab=hom-nay");
    expect(tabHref("tuan")).toBe("/today?tab=tuan");
    expect(tabHref("binh-yen")).toBe("/binh-yen");
  });
});
