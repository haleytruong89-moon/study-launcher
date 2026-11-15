import { describe, expect, it } from "vitest";
import { moreGroups } from "@/lib/parent/more";

describe("Thêm → Việc của con (L-2)", () => {
  it("adds Gia sư AI Toán right under App môn học when the tutor is set up", () => {
    const links = moreGroups(true).find((g) => g.title === "Việc của con")!.links;
    const i = links.findIndex((l) => l.label === "App môn học");
    expect(links[i + 1]).toMatchObject({ href: "/gia-su/bo-me", label: "Gia sư AI Toán", external: true });
  });
  it("without TUTOR_APP_ORIGIN the page is as before", () => {
    const all = moreGroups(false).flatMap((g) => g.links);
    expect(all.some((l) => l.href.startsWith("/gia-su"))).toBe(false);
    expect(all.some((l) => l.external)).toBe(false);
  });
});
