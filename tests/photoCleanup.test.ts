import { describe, expect, it } from "vitest";
import {
  byFolder,
  childFolders,
  cutoffDate,
  expiredDateFolders,
  expiredHomeworkPaths,
  expiredProofFiles,
  isExpiredDate,
  isExpiredHomework,
  isExpiredInstant,
  isExpiredObject,
  photosExpiredOn,
  retentionDays,
  type HomeworkRow,
} from "@/lib/cleanup/rules";

const FAM = "11111111-1111-4111-8111-111111111111";
const KID = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const F1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const F2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const F3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

// 01/11/2026 17:00 in Viet Nam. 120 days earlier = 04/07/2026, the first day KEPT.
const NOW = new Date("2026-11-01T10:00:00Z");
const CUT = "2026-07-04";
const OLD = "2026-06-01T03:00:00Z";
const RECENT = "2026-10-20T03:00:00Z";

describe("retentionDays", () => {
  it("uses the setting, with a floor of 7 days", () => {
    expect(retentionDays(120)).toBe(120);
    expect(retentionDays(7)).toBe(7);
    expect(retentionDays(3)).toBe(7);
    expect(retentionDays(1)).toBe(7);
  });
  it("refuses anything that is not a positive whole number (= delete nothing)", () => {
    for (const v of [0, -5, 1.5, "120", null, undefined, Number.NaN]) expect(retentionDays(v)).toBeNull();
  });
});

describe("cutoffDate (Asia/Ho_Chi_Minh)", () => {
  it("is today minus N family days", () => {
    expect(cutoffDate(NOW, 120)).toBe(CUT);
    expect(cutoffDate(NOW, 7)).toBe("2026-10-25");
  });
  it("follows the Viet Nam date, not UTC", () => {
    // 31/10 16:59 UTC = 31/10 23:59 in VN; 31/10 17:00 UTC = 01/11 00:00 in VN.
    expect(cutoffDate(new Date("2026-10-31T16:59:59Z"), 120)).toBe("2026-07-03");
    expect(cutoffDate(new Date("2026-10-31T17:00:00Z"), 120)).toBe(CUT);
  });
});

describe("expiry boundaries", () => {
  it("keeps a file exactly N days old; deletes N + 1", () => {
    expect(isExpiredDate(CUT, CUT)).toBe(false); // 04/07 = exactly 120 days before 01/11
    expect(isExpiredDate("2026-07-03", CUT)).toBe(true);
    expect(isExpiredDate("2026-10-31", CUT)).toBe(false);
  });
  it("ignores malformed dates", () => {
    for (const d of ["", "2026-7-3", "abc", "2026-13-45", null, undefined]) expect(isExpiredDate(d, CUT)).toBe(false);
  });
  it("judges instants by their Viet Nam date", () => {
    expect(isExpiredInstant("2026-07-03T16:59:59Z", CUT)).toBe(true); // 03/07 23:59 VN
    expect(isExpiredInstant("2026-07-03T17:00:00Z", CUT)).toBe(false); // 04/07 00:00 VN
    expect(isExpiredInstant(null, CUT)).toBe(false);
    expect(isExpiredInstant("not a date", CUT)).toBe(false);
  });
});

describe("storage objects", () => {
  it("needs an old upload (creation) time", () => {
    expect(isExpiredObject({ name: "x.jpg", id: "1", created_at: OLD }, CUT)).toBe(true);
    expect(isExpiredObject({ name: "x.jpg", id: "1", created_at: "2026-07-03T17:00:00Z" }, CUT)).toBe(false); // 04/07 00:00 VN
    expect(isExpiredObject({ name: "x.jpg", id: "1", created_at: RECENT }, CUT)).toBe(false);
    expect(isExpiredObject({ name: "x.jpg", id: "1" }, CUT)).toBe(false);
    expect(isExpiredObject({ name: "folder", id: null, created_at: OLD }, CUT)).toBe(false);
  });

  it("scans only UUID child folders and old date folders, oldest first", () => {
    expect(childFolders([KID, "junk", OTHER, ".emptyFolderPlaceholder"])).toEqual([KID, OTHER]);
    expect(expiredDateFolders(["2026-07-03", CUT, "2026-01-02", "notes", "2026-10-31"], CUT)).toEqual(["2026-01-02", "2026-07-03"]);
  });

  it("deletes proof photos in an old folder only when the object itself is old", () => {
    const objects = [
      { name: `${F2}.jpg`, id: "2", created_at: OLD },
      { name: `${F1}.jpg`, id: "1", created_at: OLD },
      { name: `${F3}.jpg`, id: "3", created_at: RECENT }, // put into an old folder recently
      { name: "readme.txt", id: "4", created_at: OLD },
      { name: "sub", id: null },
    ];
    expect(expiredProofFiles("2026-06-01", objects, CUT).map((o) => o.name)).toEqual([`${F1}.jpg`, `${F2}.jpg`]);
    expect(expiredProofFiles(CUT, objects, CUT)).toEqual([]); // the folder is exactly 120 days old
  });
});

describe("homework files", () => {
  const base: HomeworkRow = {
    id: "h1",
    child_id: KID,
    due_date: "2026-05-30",
    created_at: "2026-05-28T03:00:00Z",
    done_at: null,
    archived_at: null,
    photo_paths: [`${FAM}/${KID}/2026-05-30/${F1}.jpg`],
  };

  it("only archived or done items, and every date must be old", () => {
    expect(isExpiredHomework({ ...base, done_at: OLD }, CUT)).toBe(true);
    expect(isExpiredHomework({ ...base, archived_at: OLD }, CUT)).toBe(true);
    expect(isExpiredHomework(base, CUT)).toBe(false); // active homework: never, however old
    expect(isExpiredHomework({ ...base, done_at: RECENT }, CUT)).toBe(false);
    expect(isExpiredHomework({ ...base, done_at: OLD, archived_at: RECENT }, CUT)).toBe(false);
    expect(isExpiredHomework({ ...base, archived_at: OLD, due_date: "2026-08-01" }, CUT)).toBe(false);
    expect(isExpiredHomework({ ...base, archived_at: OLD, created_at: RECENT }, CUT)).toBe(false);
    expect(isExpiredHomework({ ...base, archived_at: OLD, created_at: null }, CUT)).toBe(false);
  });

  it("done exactly 120 days ago (Viet Nam date) is kept", () => {
    expect(isExpiredHomework({ ...base, done_at: "2026-07-03T17:00:00Z" }, CUT)).toBe(false); // 04/07 00:00 VN
    expect(isExpiredHomework({ ...base, done_at: "2026-07-03T16:59:00Z" }, CUT)).toBe(true);
  });

  it("never deletes a file still listed on a kept item, nor files outside the family/child folder", () => {
    const shared = `${FAM}/${KID}/2026-05-30/${F2}.pdf`;
    const rows: HomeworkRow[] = [
      { ...base, id: "a", archived_at: OLD, photo_paths: [`${FAM}/${KID}/2026-05-30/${F1}.jpg`, shared, `${FAM}/${OTHER}/2026-05-30/${F3}.jpg`, "../../etc/passwd"] },
      { ...base, id: "b", done_at: null, archived_at: null, photo_paths: [shared] }, // still active
      { ...base, id: "c", done_at: OLD, photo_paths: [`${FAM}/${KID}/2026-05-30/${F1}.jpg`] }, // duplicate path
    ];
    expect(expiredHomeworkPaths(rows, FAM, CUT)).toEqual([`${FAM}/${KID}/2026-05-30/${F1}.jpg`]);
    expect(expiredHomeworkPaths(rows, OTHER, CUT)).toEqual([]);
  });

  it("groups paths by folder", () => {
    const m = byFolder([`a/b/2026-01-01/${F1}.jpg`, `a/b/2026-01-01/${F2}.jpg`, `a/b/2026-01-02/${F3}.jpg`, "nofolder"]);
    expect([...m.entries()]).toEqual([
      ["a/b/2026-01-01", [`${F1}.jpg`, `${F2}.jpg`]],
      ["a/b/2026-01-02", [`${F3}.jpg`]],
    ]);
  });
});

describe("photosExpiredOn (screens)", () => {
  it("tells a screen that a day's photos were removed", () => {
    expect(photosExpiredOn("2026-07-03", NOW, 120)).toBe(true);
    expect(photosExpiredOn(CUT, NOW, 120)).toBe(false);
    expect(photosExpiredOn("2026-10-20", NOW, 7)).toBe(true);
    expect(photosExpiredOn("2026-07-03", NOW, null)).toBe(false);
  });
});
