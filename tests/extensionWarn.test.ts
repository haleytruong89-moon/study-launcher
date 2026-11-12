import { afterEach, describe, expect, it, vi } from "vitest";
import {
  effectiveState,
  initialSyncState,
  planAlarms,
  reduceSync,
  type ExtStatePayload,
  type SyncEvent,
  type SyncState,
} from "@/extension/src/core/sync";
import {
  BADGE_WARN_COLOR,
  badgeFor,
  currentWarning,
  planWarning,
  warningAfterPoll,
  warningAtAlarm,
  warningText,
} from "@/extension/src/core/warn";
import { buildRules } from "@/extension/src/core/rules";

// D2 A2: the 5-minute heads-up is display only, on the server clock.
const LAUNCHER_URL = "https://study-launcher.vercel.app";
const UNTIL = "2026-10-15T12:45:00.000Z";

function payload(over: Partial<ExtStatePayload> = {}): ExtStatePayload {
  return {
    open: true,
    openUntil: UNTIL,
    allow: ["math-app-gules.vercel.app"],
    blockAlways: ["translate.goog"],
    launcherUrl: LAUNCHER_URL,
    pollSeconds: 60,
    serverNow: "2026-10-15T12:00:00.000Z",
    allowLocalFiles: false,
    ...over,
  };
}
const ok = (p: ExtStatePayload): SyncEvent => ({ type: "pollSucceeded", payload: p });
const run = (events: SyncEvent[]): SyncState => events.reduce(reduceSync, initialSyncState());
const at = (serverNow: string) => run([ok(payload({ serverNow }))]);

afterEach(() => {
  vi.useRealTimers();
});

describe("planWarning", () => {
  it("sets an alarm at openUntil - 5 min on the server clock", () => {
    expect(planWarning(at("2026-10-15T12:00:00.000Z"))).toEqual({ alarm: { openUntil: UNTIL, delayInMinutes: 40 }, now: null });
  });

  it("no alarm when the warning time is 1 minute away or less (the next poll warns)", () => {
    expect(planWarning(at("2026-10-15T12:39:00.000Z"))).toEqual({ alarm: null, now: null });
    expect(planWarning(at("2026-10-15T12:39:30.000Z"))).toEqual({ alarm: null, now: null });
    expect(planWarning(at("2026-10-15T12:38:30.000Z")).alarm?.delayInMinutes).toBe(1.5);
  });

  it("inside the last 5 minutes it warns now, in whole minutes rounded up", () => {
    expect(planWarning(at("2026-10-15T12:40:00.000Z")).now).toEqual({ openUntil: UNTIL, minutesLeft: 5 });
    expect(planWarning(at("2026-10-15T12:42:10.000Z")).now).toEqual({ openUntil: UNTIL, minutesLeft: 3 });
    expect(planWarning(at("2026-10-15T12:44:59.000Z")).now).toEqual({ openUntil: UNTIL, minutesLeft: 1 });
  });

  it("nothing when ended, locked, without openUntil, after a failure or before confirmation", () => {
    const none = { alarm: null, now: null };
    expect(planWarning(at(UNTIL))).toEqual(none);
    expect(planWarning(run([ok(payload({ open: false, openUntil: null }))]))).toEqual(none);
    expect(planWarning(run([ok(payload({ openUntil: null }))]))).toEqual(none);
    expect(planWarning(run([ok(payload()), { type: "pollFailed" }]))).toEqual(none);
    expect(planWarning(run([ok(payload()), { type: "startup" }]))).toEqual(none);
    expect(planWarning(initialSyncState())).toEqual(none);
  });

  it("does not depend on the laptop clock", () => {
    vi.useFakeTimers();
    const ref = [planWarning(at("2026-10-15T12:00:00.000Z")), planWarning(at("2026-10-15T12:41:00.000Z"))];
    for (const t of ["1999-01-01T00:00:00Z", "2026-10-15T12:44:00Z", "2099-12-31T00:00:00Z"]) {
      vi.setSystemTime(new Date(t));
      expect([planWarning(at("2026-10-15T12:00:00.000Z")), planWarning(at("2026-10-15T12:41:00.000Z"))]).toEqual(ref);
    }
  });
});

describe("the warning never changes what is locked", () => {
  it("effective state, rules and the openUntil alarm are the same whether warned or not", () => {
    for (const now of ["2026-10-15T12:00:00.000Z", "2026-10-15T12:41:00.000Z"]) {
      const s = at(now);
      const eff = effectiveState(s, LAUNCHER_URL);
      planWarning(s);
      expect(effectiveState(s, LAUNCHER_URL)).toEqual(eff);
      expect(eff.openUntil).toBe(UNTIL);
      expect(buildRules(eff)).toEqual([]);
      expect(planAlarms(s).openUntil?.openUntil).toBe(UNTIL);
    }
  });
});

describe("currentWarning / warningAfterPoll / warningAtAlarm", () => {
  const open = { locked: false, openUntil: UNTIL };
  const w = { openUntil: UNTIL, minutesLeft: 4 };

  it("keeps a warning only for the window being enforced", () => {
    expect(currentWarning(w, open)).toEqual(w);
    expect(currentWarning(w, { locked: true, openUntil: null })).toBeNull();
    expect(currentWarning(w, { locked: false, openUntil: "2026-10-15T13:30:00.000Z" })).toBeNull(); // parent extended it
    expect(currentWarning(w, { locked: false, openUntil: null })).toBeNull();
    expect(currentWarning(null, open)).toBeNull();
    expect(currentWarning({ openUntil: UNTIL, minutesLeft: "4" }, open)).toBeNull();
    expect(currentWarning({ openUntil: UNTIL, minutesLeft: 99 }, open)).toEqual({ openUntil: UNTIL, minutesLeft: 5 });
  });

  it("after a poll: the poll's own warning, else an earlier one for the same window", () => {
    const early = planWarning(at("2026-10-15T12:00:00.000Z"));
    const late = planWarning(at("2026-10-15T12:42:30.000Z"));
    expect(warningAfterPoll(null, early, open)).toBeNull();
    expect(warningAfterPoll(null, late, open)).toEqual({ openUntil: UNTIL, minutesLeft: 3 });
    expect(warningAfterPoll(w, early, open)).toEqual(w); // alarm fired a moment before the poll
    expect(warningAfterPoll(w, early, { locked: false, openUntil: "2026-10-15T13:30:00.000Z" })).toBeNull();
    expect(warningAfterPoll(w, late, { locked: true, openUntil: null })).toBeNull();
  });

  it("an alarm for an old window shows nothing", () => {
    expect(warningAtAlarm(UNTIL, open)).toEqual({ openUntil: UNTIL, minutesLeft: 5 });
    expect(warningAtAlarm("2026-10-15T11:00:00.000Z", open)).toBeNull();
    expect(warningAtAlarm(UNTIL, { locked: true, openUntil: null })).toBeNull();
  });
});

describe("badge and popup text", () => {
  it("empty while locked, 5' in calm green while warned, MỞ otherwise", () => {
    expect(badgeFor({ locked: true }, { openUntil: UNTIL, minutesLeft: 5 }).text).toBe("");
    expect(badgeFor({ locked: false }, { openUntil: UNTIL, minutesLeft: 5 })).toEqual({ text: "5'", color: BADGE_WARN_COLOR });
    expect(BADGE_WARN_COLOR).toBe("#2B5D4F");
    expect(badgeFor({ locked: false }, null)).toEqual({ text: "MỞ", color: "#B85A1C" });
  });

  it("popup line", () => {
    expect(warningText({ openUntil: UNTIL, minutesLeft: 5 })).toBe("Còn 5 phút nữa máy khóa lại — lưu bài nhé.");
  });
});
