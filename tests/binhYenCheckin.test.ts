import { describe, expect, it } from "vitest";
import { ackFor, enoughLine, homeCopy, mentorLine, voiceFor } from "@/lib/binhYen/catalog";
import { DELETE_ALL_WORD, checkinBodySchema, checkinProblem, checkinView, deleteBodySchema, heavyRepeat, HEAVY_REPEAT_TEXT, typedDeleteWord, type CheckinBody } from "@/lib/binhYen/checkin";
import { STUDY_CAP_TEXT, isStudyTime, studyCap, studyChip } from "@/lib/binhYen/studyCap";

// Góc bình yên S-BY1 (docs/BINH_YEN.md §2.2, §4, R5, D1, Q6, Q7).

const RUN = "8d3c6f5e-7a21-4b7e-9c11-2f4e5a6b7c8d";
const body = (b: Partial<CheckinBody>): CheckinBody => ({ clientRunId: RUN, quad: "red", word: "lo_lang", intensity: 5, activity: "breath", ...b });

describe("check-in validation (keys only, D1)", () => {
  it("accepts the e2e path: red · lo lắng · 5 · breathing", () => expect(checkinProblem("detective", body({}))).toBeNull());
  it("accepts 'Vậy là đủ cho hôm nay' (no activity)", () => expect(checkinProblem("detective", body({ activity: null }))).toBeNull());
  it("refuses an unknown quadrant, a word of another quadrant, an unknown word", () => {
    expect(checkinProblem("detective", body({ quad: "purple" }))).toMatch(/Ô cảm xúc/);
    expect(checkinProblem("detective", body({ word: "vui" }))).toMatch(/Từ cảm xúc/);
    expect(checkinProblem("detective", body({ word: "con buồn lắm" }))).toMatch(/Từ cảm xúc/);
  });
  it("intensity: required for unpleasant, refused for pleasant", () => {
    expect(checkinProblem("detective", body({ intensity: null }))).toMatch(/Thiếu mức độ/);
    expect(checkinProblem("detective", body({ quad: "yellow", word: "vui", intensity: 3 }))).toMatch(/khó chịu/);
    expect(checkinProblem("detective", body({ quad: "yellow", word: "vui", intensity: null }))).toBeNull();
  });
  it("activity must be in the child's own list", () => {
    expect(checkinProblem("detective", body({ activity: "heart" }))).toMatch(/Hoạt động/); // An's experiment
    expect(checkinProblem("scientist", body({ activity: "heart" }))).toBeNull();
    expect(checkinProblem("scientist", body({ activity: "dance" }))).toMatch(/Hoạt động/);
    expect(checkinProblem("detective", body({ activity: "Viết rồi buông" }))).toMatch(/Hoạt động/);
  });
  it("the body schema refuses extra fields (no place for text) and bad ids", () => {
    expect(checkinBodySchema.safeParse({ ...body({}), note: "hôm nay buồn" }).success).toBe(false);
    expect(checkinBodySchema.safeParse({ ...body({}), clientRunId: "abc" }).success).toBe(false);
    expect(checkinBodySchema.safeParse({ ...body({}), intensity: 6 }).success).toBe(false);
    expect(checkinBodySchema.safeParse(body({})).success).toBe(true);
  });
  it("delete: one id, or all — nothing else", () => {
    expect(deleteBodySchema.safeParse({ id: RUN }).success).toBe(true);
    expect(deleteBodySchema.safeParse({ all: true }).success).toBe(true);
    expect(deleteBodySchema.safeParse({ all: false }).success).toBe(false);
    expect(deleteBodySchema.safeParse({ id: RUN, all: true }).success).toBe(false);
    expect(deleteBodySchema.safeParse({ childId: RUN }).success).toBe(false);
  });
});

describe("Lần ghé gần đây", () => {
  const row = { id: RUN, local_date: "2026-11-06", quad: "red", word_key: "lo_lang", intensity: 5, activity_key: "breath", created_at: "2026-11-06T12:00:00Z" };
  it("shows date, word and activity in the child's voice", () => {
    expect(checkinView(row, "detective")).toEqual({ id: RUN, date: "06/11", quad: "red", word: "lo lắng", activity: "Thở cho dịu lại" });
  });
  it("'Vậy là đủ' has no activity; an old key still shows something", () => {
    expect(checkinView({ ...row, activity_key: null }, "detective").activity).toBeNull();
    expect(checkinView({ ...row, word_key: "gone", activity_key: "gone" }, "detective")).toMatchObject({ word: "(từ cũ)", activity: "(hoạt động cũ)" });
  });
});

describe("repeated 'rất to' (R3, no text; shown only to the child)", () => {
  const now = new Date("2026-11-06T12:00:00Z");
  const r = (daysAgo: number, intensity: number | null = 5) => ({ intensity, created_at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString() });
  it("3 times level 5 in 7 days", () => expect(heavyRepeat([r(0), r(3), r(6.9)], now)).toBe(true));
  it("2 times, or older than 7 days, or level 4 → no", () => {
    expect(heavyRepeat([r(0), r(3)], now)).toBe(false);
    expect(heavyRepeat([r(0), r(3), r(7.5)], now)).toBe(false);
    expect(heavyRepeat([r(0), r(1), r(2, 4)], now)).toBe(false);
  });
});

describe("R5 study time (server clock, computeDayState)", () => {
  const day = (status: string, extra: { open?: boolean; free?: string | null; part2?: boolean } = {}) => ({
    status: status as never,
    open: extra.open ?? false,
    free: { startedAt: extra.free ?? null, endsAt: null },
    part2: { complete: extra.part2 ?? false } as never,
  });
  it.each([
    ["LOCK_P1", true],
    ["BREAK_OFFER", true],
    ["LOCK_P2", true],
    ["LOCK_OVERRIDE", true],
  ])("%s → study time", (s, want) => expect(isStudyTime(day(s))).toBe(want));
  it("break, free time, open days, a finished day → no limit (R5 #2)", () => {
    expect(isStudyTime(day("BREAK", { open: true }))).toBe(false);
    expect(isStudyTime(day("FREE", { open: true, free: "2026-11-06T11:00:00Z" }))).toBe(false);
    expect(isStudyTime(day("LOCK_END", { free: "2026-11-06T10:00:00Z", part2: true }))).toBe(false);
    expect(isStudyTime(day("OPEN_TRUST", { open: true }))).toBe(false);
    expect(isStudyTime(day("OPEN_SICK", { open: true }))).toBe(false);
    expect(isStudyTime(day("OPEN_OVERRIDE", { open: true }))).toBe(false);
    expect(isStudyTime(day("LOCK_OVERRIDE", { free: "2026-11-06T10:00:00Z" }))).toBe(false);
  });
  // 19:00 in Viet Nam = 12:00Z.
  const start = "2026-11-06T12:00:00Z";
  it("R5 #1: in at 19:00 → back to Hôm nay at 19:10", () => {
    expect(studyCap(true, start, 10, new Date("2026-11-06T12:09:59Z"))).toEqual({ study: true, minutes: 10, endsAt: "2026-11-06T12:10:00.000Z", capped: false });
    expect(studyCap(true, start, 10, new Date("2026-11-06T12:10:00Z")).capped).toBe(true);
  });
  it("R5 #2: outside study time there is no limit", () => {
    expect(studyCap(false, start, 10, new Date("2026-11-06T15:00:00Z"))).toEqual({ study: false, minutes: 10, endsAt: null, capped: false });
  });
  it("R5 #3 (Q6): a new visit (new PIN session) has its own 10 minutes", () => {
    expect(studyCap(true, "2026-11-06T12:10:05Z", 10, new Date("2026-11-06T12:10:06Z")).capped).toBe(false);
  });
  it("uses the family setting", () => expect(studyCap(true, start, 15, new Date("2026-11-06T12:12:00Z")).capped).toBe(false));
  it("wording", () => {
    expect(STUDY_CAP_TEXT).toBe("Quay lại học nhé, lúc nào cần thì vào lại.");
    expect(studyChip(10, "19:10")).toBe("Giờ học: mỗi lần tối đa 10 phút · đến 19:10");
  });
});

describe("voices", () => {
  it("lớp 6 → nhà khoa học (An), lớp 9 → thám tử (Nguyên)", () => {
    expect(voiceFor(6)).toBe("scientist");
    expect(voiceFor(9)).toBe("detective");
    expect(voiceFor(null)).toBe("detective");
  });
  it("acknowledgement step: 'Ổn thôi, mình ở đây' / 'Dừng lại một chút nào'", () => {
    expect(ackFor("detective", "red", "lo lắng").title).toBe("Ổn thôi, mình ở đây");
    expect(ackFor("scientist", "blue", "buồn").title).toBe("Dừng lại một chút nào");
    expect(ackFor("detective", "yellow", "vui").title).toBe("Giữ lấy cảm giác này");
    expect(ackFor("scientist", "green", "bình yên").title).toBe("Một phát hiện vui!");
  });
  it("greetings and mentor lines use the child's name", () => {
    expect(homeCopy("scientist", "An").greeting).toBe("Chào nhà thám hiểm An!");
    expect(homeCopy("detective", "Nguyên").greeting).toBe("Chào Nguyên.");
    expect(mentorLine("scientist", "red", "tức giận", "An")).toContain("Núi lửa trong An");
    expect(enoughLine("chán")).toContain("Vậy là đủ cho hôm nay");
  });
});

describe("“Xóa hết của con” needs XÓA typed (07/11/2026)", () => {
  it.each(["XÓA", "xóa", " Xóa ", "XÓA\n", "xo\u0301a"])("accepts %j", (v) => expect(typedDeleteWord(v)).toBe(true));
  it.each(["", "X", "XOA", "xoa", "XÓA HẾT", "ok"])("refuses %j", (v) => expect(typedDeleteWord(v)).toBe(false));
  it("the word shown is XÓA", () => expect(DELETE_ALL_WORD).toBe("XÓA"));
});

describe("repeated level 5 note (parent 06/11/2026)", () => {
  it("points to parents / a trusted teacher, with no hotline number", () => {
    expect(HEAVY_REPEAT_TEXT).toContain("bố mẹ");
    expect(HEAVY_REPEAT_TEXT).not.toMatch(/111|115/);
  });
});
