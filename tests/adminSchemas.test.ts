import { describe, expect, it } from "vitest";
import {
  homeworkSchema,
  isHomeworkPhotoPath,
  isValidLocalDate,
  normalizeDomain,
  settingsSchema,
  slotDomains,
  slotSchema,
  slotToRow,
  templateSchema,
} from "@/lib/admin/schemas";
import { addDays } from "@/lib/admin/dates";
import { fitWithin } from "@/lib/images";
import { formatWeekdays } from "@/lib/subjects";

const FAMILY = "11111111-1111-4111-8111-111111111111";
const CHILD = "22222222-2222-4222-8222-222222222222";
const OTHER_CHILD = "33333333-3333-4333-8333-333333333333";
const FILE = "44444444-4444-4444-8444-444444444444.jpg";

describe("normalizeDomain", () => {
  it.each([
    ["example.com", "example.com"],
    ["  Example.COM ", "example.com"],
    ["https://www.example.com/path?q=1#x", "www.example.com"],
    ["*.example.com", "example.com"],
    ["example.com:443", "example.com"],
    ["sub-domain.ex-ample.vn.", "sub-domain.ex-ample.vn"],
  ])("%s -> %s", (input, out) => expect(normalizeDomain(input)).toBe(out));

  it.each(["", "localhost", "not a domain", "-bad.com", "bad-.com", "a..b.com", "javascript:alert(1)", "1.2.3"])(
    "rejects %j",
    (input) => expect(normalizeDomain(input)).toBeNull(),
  );
});

describe("settingsSchema", () => {
  const ok = {
    breakMinutes: 10,
    freeMinutes: 45,
    extraMinMinutes: 20,
    skillMinMinutes: 20,
    passesPerWeek: 1,
    trustUpPct: 90,
    trustUpWeeks: 3,
    trustDownPct: 70,
    homeworkLookaheadDays: 1,
    photoRetentionDays: 120,
    bedtimes: [{ childId: CHILD, bedtime: "21:30" }],
  };

  it("accepts the family defaults", () => expect(settingsSchema.safeParse(ok).success).toBe(true));

  it("normalizes a bedtime with seconds", () => {
    const r = settingsSchema.parse({ ...ok, bedtimes: [{ childId: CHILD, bedtime: "21:30:00" }] });
    expect(r.bedtimes[0]?.bedtime).toBe("21:30");
  });

  it.each([
    ["negative minutes", { breakMinutes: -1 }],
    ["fractional minutes", { freeMinutes: 4.5 }],
    ["pct over 100", { trustUpPct: 101 }],
    ["zero trust weeks", { trustUpWeeks: 0 }],
    ["down threshold above up threshold", { trustDownPct: 95 }],
    ["bad bedtime", { bedtimes: [{ childId: CHILD, bedtime: "25:00" }] }],
    ["bad child id", { bedtimes: [{ childId: "nope", bedtime: "21:00" }] }],
  ])("rejects %s", (_, patch) => expect(settingsSchema.safeParse({ ...ok, ...patch }).success).toBe(false));
});

describe("slotSchema", () => {
  it("needs a URL unless the slot is a placeholder", () => {
    expect(slotSchema.safeParse({ subject: "Văn", kind: "external", label: "App Văn" }).success).toBe(false);
    expect(slotSchema.safeParse({ subject: "Văn", kind: "placeholder", label: "App Văn", url: "" }).success).toBe(true);
  });

  it("rejects non-http URLs and bad domains", () => {
    expect(slotSchema.safeParse({ subject: "x", kind: "external", label: "x", url: "javascript:alert(1)" }).success).toBe(false);
    expect(
      slotSchema.safeParse({ subject: "x", kind: "external", label: "x", url: "https://a.com", allowDomains: ["not a domain"] }).success,
    ).toBe(false);
  });

  it.each([
    ["a shared-hosting suffix", { allowDomains: ["vercel.app"] }],
    ["a wildcard shared suffix", { allowDomains: ["*.github.io"] }],
    ["Google Search", { allowDomains: ["https://www.google.com/search?q=x"] }],
    ["YouTube via the app URL", { url: "https://www.youtube.com/watch?v=x" }],
    ["Google Translate proxies", { allowDomains: ["abc.translate.goog"] }],
  ])("refuses %s (would open too much while locked)", (_, patch) => {
    expect(slotSchema.safeParse({ subject: "x", kind: "external", label: "x", url: "https://app.example.com", ...patch }).success).toBe(false);
  });

  it("still allows a specific subdomain such as classroom.google.com", () => {
    expect(slotSchema.safeParse({ subject: "x", kind: "external", label: "x", url: "https://classroom.google.com" }).success).toBe(true);
  });

  it("adds the URL host to the allowed domains, normalized and de-duplicated", () => {
    const s = slotSchema.parse({
      subject: "Toán",
      kind: "internal",
      label: "App Toán",
      url: "https://Math-App-Gules.vercel.app/lesson/1",
      allowDomains: ["https://cdn.example.com/x", "math-app-gules.vercel.app"],
    });
    expect(slotDomains(s)).toEqual(["cdn.example.com", "math-app-gules.vercel.app"]);
    expect(slotToRow(s)).toMatchObject({ child_id: null, kind: "internal", active: true });
  });
});

describe("templateSchema", () => {
  const ok = { childId: CHILD, part: "extra", title: "Toán bổ sung", weekdays: [3, 1, 1, 5] };

  it("sorts and de-duplicates weekdays; empty optional fields become null", () => {
    const t = templateSchema.parse({ ...ok, subject: "", deepLink: "", minMinutes: null });
    expect(t.weekdays).toEqual([1, 3, 5]);
    expect(t.subject).toBeNull();
    expect(t.deepLink).toBeNull();
    expect(t.minMinutes).toBeNull();
    expect(t.appSlotId).toBeNull();
  });

  it.each([
    ["no weekday", { weekdays: [] }],
    ["weekday 0", { weekdays: [0] }],
    ["weekday 8", { weekdays: [8] }],
    ["unknown part", { part: "homework" }],
    ["empty title", { title: "  " }],
    ["negative minutes", { minMinutes: -5 }],
    ["non-http deep link", { deepLink: "file:///etc/passwd" }],
  ])("rejects %s", (_, patch) => expect(templateSchema.safeParse({ ...ok, ...patch }).success).toBe(false));
});

describe("homeworkSchema + photo paths", () => {
  const ok = { childId: CHILD, subject: "Toán", dueDate: "2026-10-15", photoPaths: [`${FAMILY}/${CHILD}/2026-10-15/${FILE}`] };

  it("accepts photos or a note, not neither", () => {
    expect(homeworkSchema.safeParse(ok).success).toBe(true);
    expect(homeworkSchema.safeParse({ ...ok, photoPaths: [], note: "Làm bài 3 SGK" }).success).toBe(true);
    expect(homeworkSchema.safeParse({ ...ok, photoPaths: [], note: "  " }).success).toBe(false);
  });

  it("rejects impossible dates", () => {
    expect(homeworkSchema.safeParse({ ...ok, dueDate: "2026-02-30" }).success).toBe(false);
    expect(isValidLocalDate("2028-02-29")).toBe(true);
    expect(isValidLocalDate("2026-13-01")).toBe(false);
  });

  it("only accepts photos in this family's + child's + due date's folder", () => {
    const good = `${FAMILY}/${CHILD}/2026-10-15/${FILE}`;
    expect(isHomeworkPhotoPath(good, FAMILY, CHILD, "2026-10-15")).toBe(true);
    expect(isHomeworkPhotoPath(good, FAMILY, OTHER_CHILD, "2026-10-15")).toBe(false);
    expect(isHomeworkPhotoPath(good, FAMILY, CHILD, "2026-10-16")).toBe(false);
    expect(isHomeworkPhotoPath(`${FAMILY}/${CHILD}/2026-10-15/../x/${FILE}`, FAMILY, CHILD, "2026-10-15")).toBe(false);
    expect(isHomeworkPhotoPath(`${FAMILY}/${CHILD}/2026-10-15/photo.exe`, FAMILY, CHILD, "2026-10-15")).toBe(false);
  });
});

describe("helpers", () => {
  it("fitWithin keeps the aspect ratio and never upscales", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(() => fitWithin(0, 10)).toThrow();
  });

  it("addDays crosses month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("formatWeekdays", () => {
    expect(formatWeekdays([1, 3, 5])).toBe("T2, T4, T6");
    expect(formatWeekdays([1, 2, 3, 4, 5, 6, 7])).toBe("Hằng ngày");
    expect(formatWeekdays([7])).toBe("CN");
  });
});
