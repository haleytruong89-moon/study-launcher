import { describe, expect, it } from "vitest";
import { childSites, type SiteEntryRow, type SiteSlotRow } from "@/lib/today/sites";

const NOW = Date.parse("2026-11-16T20:00:00+07:00");
const e = (domain: string, grp = "external", expires_at: string | null = null): SiteEntryRow => ({ domain, grp, expires_at });
const slot = (over: Partial<SiteSlotRow> = {}): SiteSlotRow => ({
  label: "English OS",
  subject: "Tiếng Anh",
  kind: "external",
  url: "https://english-os.example/app",
  allow_domains: ["english-os.example", "cdn.english-os.example"],
  active: true,
  ...over,
});

describe("Trang con mở được (16/11/2026)", () => {
  it("app slots by name, bundles by name (helper domains hidden), the rest by domain", () => {
    const groups = childSites(
      [slot(), slot({ label: "Đang xây", kind: "placeholder" }), slot({ label: "Tắt", active: false })],
      [
        e("study-launcher-nine.vercel.app", "system"),
        e("english-os.example", "internal"),
        e("cdn.english-os.example", "internal"),
        e("meet.google.com"),
        e("ogs.google.com"),
        e("apis.google.com"),
        e("contacts.google.com"),
        e("dictionary.cambridge.org", "dictionary"),
        e("*.khanacademy.org", "child_pick"),
      ],
      NOW,
      "study-launcher-nine.vercel.app",
    );
    expect(groups.map((g) => g.title)).toEqual(["App học của con", "Học online, tài liệu, nhắn thầy cô", "Từ điển, dịch", "Trang khác bố mẹ cho mở"]);
    expect(groups[0]?.links).toEqual([{ label: "English OS", sub: "Tiếng Anh", href: "https://english-os.example/app" }]);
    expect(groups[1]?.links.map((l) => [l.label, l.href])).toEqual([["Google Meet", "https://meet.google.com"]]);
    expect(groups[2]?.links).toEqual([{ label: "dictionary.cambridge.org", sub: null, href: "https://dictionary.cambridge.org" }]);
    expect(groups[3]?.links.map((l) => l.href)).toEqual(["https://khanacademy.org"]);
  });

  it("opened for a while: first, with the time; expired rows are gone", () => {
    const groups = childSites([], [e("vi.wikipedia.org", "request", "2026-11-16T14:30:00Z"), e("old.example", "request", "2026-11-16T12:00:00Z")], NOW, null);
    expect(groups).toEqual([{ title: "Mở tạm", links: [{ label: "vi.wikipedia.org", sub: "Bố mẹ cho mở đến 21:30", href: "https://vi.wikipedia.org" }] }]);
  });

  it("a bundle shows only when its main site is on; nothing → no group", () => {
    expect(childSites([], [e("ogs.google.com")], NOW, null)).toEqual([{ title: "Trang khác bố mẹ cho mở", links: [{ label: "ogs.google.com", sub: null, href: "https://ogs.google.com" }] }]);
    expect(childSites([], [], NOW, null)).toEqual([]);
  });

  it("a slot with a non-web link is skipped; duplicates show once", () => {
    const groups = childSites([slot({ url: "javascript:alert(1)" })], [e("a.example"), e("a.example", "child_pick")], NOW, null);
    expect(groups).toEqual([{ title: "Trang khác bố mẹ cho mở", links: [{ label: "a.example", sub: null, href: "https://a.example" }] }]);
  });
});
