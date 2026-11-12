import { describe, expect, it } from "vitest";
import {
  homeworkSchema,
  homeworkPatchSchema,
  isValidLocalDate,
  normalizeDomain,
  settingsSchema,
  settingsToRow,
  slotDomains,
  slotSchema,
  slotToRow,
  templateSchema,
} from "@/lib/admin/schemas";
import { fileKind, isHomeworkFilePath, storedExt } from "@/lib/files";
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
    ["break tiers not ascending", { breakTiers: [[45, 10], [40, 30]] }],
    ["break tiers with a zero", { breakTiers: [[45, 0], [90, 30]] }],
    ["break tiers break minutes not ascending", { breakTiers: [[45, 30], [90, 30]] }],
    ["empty break tiers", { breakTiers: [] }],
    ["fractional break tier", { breakTiers: [[45.5, 10]] }],
    ["13 breaks a day", { breakMaxPerDay: 13 }],
  ])("rejects %s", (_, patch) => expect(settingsSchema.safeParse({ ...ok, ...patch }).success).toBe(false));

  it("R8b: accepts the break bank rules and writes them as columns", () => {
    const r = settingsSchema.parse({ ...ok, breakTiers: [[45, 10], [90, 30], [120, 45], [180, 60]], breakMaxPerDay: 6 });
    expect(settingsToRow(r)).toMatchObject({ break_tiers: [[45, 10], [90, 30], [120, 45], [180, 60]], break_max_per_day: 6 });
    expect(settingsToRow(settingsSchema.parse(ok))).not.toHaveProperty("break_tiers");
  });

  it.each([30, 180, 600])("A7: accepts a run cap of %i minutes and writes the column", (cap) => {
    expect(settingsToRow(settingsSchema.parse({ ...ok, breakRunCapMinutes: cap }))).toMatchObject({ break_run_cap_minutes: cap });
  });

  it.each([29, 601, 90.5])("A7: rejects a run cap of %s minutes", (cap) =>
    expect(settingsSchema.safeParse({ ...ok, breakRunCapMinutes: cap }).success).toBe(false),
  );

  it("A7: leaves the run cap untouched when the form does not send it (before 0014)", () =>
    expect(settingsToRow(settingsSchema.parse(ok))).not.toHaveProperty("break_run_cap_minutes"));
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

  it("only accepts files in this family's + child's folder (any date folder, allowed types)", () => {
    const good = `${FAMILY}/${CHILD}/2026-10-15/${FILE}`;
    const uuid = FILE.slice(0, FILE.lastIndexOf("."));
    expect(isHomeworkFilePath(good, FAMILY, CHILD)).toBe(true);
    expect(isHomeworkFilePath(`${FAMILY}/${CHILD}/2026-10-20/${uuid}.pdf`, FAMILY, CHILD)).toBe(true);
    expect(isHomeworkFilePath(`${FAMILY}/${CHILD}/2026-10-20/${uuid}.docx`, FAMILY, CHILD)).toBe(true);
    expect(isHomeworkFilePath(`${FAMILY}/${CHILD}/2026-10-20/${uuid}.xlsx`, FAMILY, CHILD)).toBe(true);
    expect(isHomeworkFilePath(good, FAMILY, OTHER_CHILD)).toBe(false);
    expect(isHomeworkFilePath(`${FAMILY}/${CHILD}/2026-10-15/../x/${FILE}`, FAMILY, CHILD)).toBe(false);
    expect(isHomeworkFilePath(`${FAMILY}/${CHILD}/2026-10-15/photo.exe`, FAMILY, CHILD)).toBe(false);
    expect(isHomeworkFilePath(`${FAMILY}/${CHILD}/2026-10-15/${uuid}.exe`, FAMILY, CHILD)).toBe(false);
    expect(isHomeworkFilePath(`${FAMILY}/${CHILD}/x/${FILE}`, FAMILY, CHILD)).toBe(false);
    expect(isHomeworkFilePath(`${FAMILY}/${CHILD}/${FILE}`, FAMILY, CHILD)).toBe(false);
  });

  it("caps attachments at 6 and accepts an edit or an archive patch", () => {
    const six = Array.from({ length: 7 }, () => `${FAMILY}/${CHILD}/2026-10-15/${FILE}`);
    expect(homeworkSchema.safeParse({ ...ok, photoPaths: six }).success).toBe(false);
    expect(homeworkPatchSchema.safeParse({ archived: true }).success).toBe(true);
    expect(homeworkPatchSchema.safeParse({ subject: "Toán", dueDate: "2026-10-20", note: "trang 12", photoPaths: [] }).success).toBe(true);
    expect(homeworkPatchSchema.safeParse({ subject: "Toán", dueDate: "2026-10-20", note: null, photoPaths: [] }).success).toBe(false);
    expect(homeworkPatchSchema.safeParse({ archived: true, subject: "x" }).success).toBe(false);
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

describe("homework files", () => {
  it("knows the allowed kinds", () => {
    expect(fileKind("a.PDF")).toBe("pdf");
    expect(fileKind("a.docx")).toBe("word");
    expect(fileKind("a.xls")).toBe("excel");
    expect(fileKind("a.jpeg")).toBe("image");
    expect(fileKind("a.exe")).toBeNull();
    expect(fileKind("noext")).toBeNull();
  });
  it("picks a stored extension from the name, else the MIME type", () => {
    expect(storedExt({ name: "De Toan.PDF", type: "" })).toBe("pdf");
    expect(storedExt({ name: "scan", type: "application/pdf" })).toBe("pdf");
    expect(storedExt({ name: "x.jpeg", type: "image/jpeg" })).toBe("jpg");
    expect(storedExt({ name: "virus.exe", type: "application/x-msdownload" })).toBeNull();
  });
});
