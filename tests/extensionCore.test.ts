import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALL_RESOURCE_TYPES,
  MANAGED_RULE_IDS,
  RULE_IDS,
  buildRules,
  planRuleUpdate,
  type DnrResourceType,
  type DnrRule,
} from "@/extension/src/core/rules";
import {
  FAIL_CLOSED_AFTER_FAILURES,
  effectiveState,
  initialSyncState,
  parseExtStatePayload,
  parseSyncState,
  planAlarms,
  reduceSync,
  type EffectiveState,
  type ExtStatePayload,
  type SyncEvent,
  type SyncState,
} from "@/extension/src/core/sync";
import { planTabSweep, shouldSweep } from "@/extension/src/core/sweep";
import { buildBlockedUrl, parseBlockedUrl } from "@/extension/src/core/blockedUrl";
import { hostMatchesDomain, normalizeHost } from "@/extension/src/core/domains";

const LAUNCHER_URL = "https://study-launcher.vercel.app";
const LAUNCHER_HOST = "study-launcher.vercel.app";
const FALLBACK = "https://fallback-launcher.example.org/";

function payload(over: Partial<ExtStatePayload> = {}): ExtStatePayload {
  return {
    open: false,
    openUntil: null,
    allow: ["math-app-gules.vercel.app", "translate.google.com", "dictionary.cambridge.org"],
    blockAlways: ["translate.goog"],
    launcherUrl: LAUNCHER_URL,
    pollSeconds: 60,
    serverNow: "2026-10-15T12:00:00.000Z",
    ...over,
  };
}

const openPayload = (over: Partial<ExtStatePayload> = {}) =>
  payload({ open: true, openUntil: "2026-10-15T12:45:00.000Z", ...over });

function run(events: SyncEvent[], start: SyncState = initialSyncState()): SyncState {
  return events.reduce(reduceSync, start);
}

const ok = (p: ExtStatePayload): SyncEvent => ({ type: "pollSucceeded", payload: p });
const fail: SyncEvent = { type: "pollFailed" };

function rulesFor(state: EffectiveState): DnrRule[] {
  return buildRules(state);
}

// ---------------------------------------------------------------------------
// Minimal declarativeNetRequest evaluator (Chrome semantics for the parts we
// use): highest priority wins; on a tie allow > block > redirect.
// ---------------------------------------------------------------------------
type Outcome = { kind: "none" } | { kind: "allow" } | { kind: "block" } | { kind: "redirect"; url: string };

function evaluate(rules: DnrRule[], url: string, type: DnrResourceType): Outcome {
  const host = normalizeHost(new URL(url).hostname) ?? "";
  const matching = rules.filter((r) => {
    if (!r.condition.resourceTypes.includes(type)) return false;
    if (r.condition.requestDomains && !r.condition.requestDomains.some((d) => hostMatchesDomain(host, d))) {
      return false;
    }
    if (r.condition.regexFilter && !new RegExp(r.condition.regexFilter, "i").test(url)) return false;
    return true;
  });
  if (matching.length === 0) return { kind: "none" };
  const rank = { allow: 3, block: 2, redirect: 1 } as const;
  matching.sort((a, b) => b.priority - a.priority || rank[b.action.type] - rank[a.action.type]);
  const top = matching[0]!;
  if (top.action.type === "redirect") {
    const re = new RegExp(top.condition.regexFilter!, "i");
    const sub = top.action.redirect.regexSubstitution.replace(/\\(\d)/g, "$$$1");
    return { kind: "redirect", url: url.replace(re, sub) };
  }
  return { kind: top.action.type };
}

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
describe("buildRules", () => {
  const locked = effectiveState(run([ok(payload())]), FALLBACK);

  it("open -> no rules at all (nothing blocked)", () => {
    const open = effectiveState(run([ok(openPayload())]), FALLBACK);
    expect(open.locked).toBe(false);
    expect(rulesFor(open)).toEqual([]);
  });

  it("locked -> 4 rules with stable ids and the DESIGN priorities", () => {
    const rules = rulesFor(locked);
    expect(rules.map((r) => [r.id, r.priority, r.action.type])).toEqual([
      [RULE_IDS.redirectAll, 1, "redirect"],
      [RULE_IDS.blockFrames, 1, "block"],
      [RULE_IDS.allowList, 2, "allow"],
      [RULE_IDS.blockAlways, 3, "block"],
    ]);
    expect(rules[0]!.condition.resourceTypes).toEqual(["main_frame"]);
    expect(rules[1]!.condition.resourceTypes).toEqual(["sub_frame"]);
    expect(rules[2]!.condition.resourceTypes).toEqual(["main_frame", "sub_frame"]);
    expect(rules[2]!.condition.requestDomains).toContain(LAUNCHER_HOST);
    expect(rules[3]!.condition.resourceTypes).toEqual([...ALL_RESOURCE_TYPES]);
    expect(rules[3]!.condition.requestDomains).toEqual(["translate.goog"]);
    // Same input -> identical output (stable for updateDynamicRules).
    expect(rulesFor(locked)).toEqual(rules);
  });

  it("redirects a blocked navigation to the lock page keeping the original URL (&, #, ?)", () => {
    const original = "https://www.youtube.com/watch?v=abc&list=PL1&t=30s#comments";
    const out = evaluate(rulesFor(locked), original, "main_frame");
    expect(out).toEqual({ kind: "redirect", url: buildBlockedUrl(LAUNCHER_URL, original) });
    if (out.kind === "redirect") expect(parseBlockedUrl(out.url)).toBe(original);
  });

  it("the DNR redirect and the tab sweep produce the same lock-page URL", () => {
    const original = "http://example.com:8080/a?b=1&c=%26#x?y";
    const out = evaluate(rulesFor(locked), original, "main_frame");
    expect(out).toEqual({ kind: "redirect", url: buildBlockedUrl(LAUNCHER_URL, original) });
  });

  it("allows main-frame navigation to allowlisted domains, their subdomains and the launcher", () => {
    const rules = rulesFor(locked);
    expect(evaluate(rules, "https://math-app-gules.vercel.app/lesson/1", "main_frame").kind).toBe("allow");
    expect(evaluate(rules, "https://translate.google.com/?sl=en", "main_frame").kind).toBe("allow");
    expect(evaluate(rules, `${LAUNCHER_URL}/blocked?u=https://x.com`, "main_frame").kind).toBe("allow");
    expect(evaluate(rules, "https://google.com/search?q=x", "main_frame").kind).toBe("redirect");
    expect(evaluate(rules, "https://evil-vercel.app/", "main_frame").kind).toBe("redirect");
  });

  it("blocks embedded frames outside the allowlist; allowlisted frames still load (parent decision 17/10)", () => {
    const rules = rulesFor(locked);
    expect(evaluate(rules, "https://www.youtube.com/embed/x", "sub_frame").kind).toBe("block");
    expect(evaluate(rules, "https://math-app-gules.vercel.app/widget", "sub_frame").kind).toBe("allow");
  });

  it("never blocks images / scripts / CDN files (only pages and frames are)", () => {
    const rules = rulesFor(locked);
    for (const type of ALL_RESOURCE_TYPES.filter((t) => t !== "main_frame" && t !== "sub_frame")) {
      expect(evaluate(rules, "https://cdn.jsdelivr.net/npm/katex/katex.min.js", type).kind).toBe("none");
      expect(evaluate(rules, "https://i.ytimg.com/vi/x/hq.jpg", type).kind).toBe("none");
    }
  });

  it("blocks *.translate.goog while locked even if allowlisted (main frame and sub-resources)", () => {
    const s = effectiveState(
      run([ok(payload({ allow: ["translate.goog", "www-youtube-com.translate.goog"], blockAlways: [] }))]),
      FALLBACK,
    );
    const rules = rulesFor(s);
    expect(rules[2]!.condition.requestDomains).toContain("translate.goog");
    const proxy = "https://www-youtube-com.translate.goog/watch?v=x&_x_tr_sl=auto";
    expect(evaluate(rules, proxy, "main_frame").kind).toBe("block");
    expect(evaluate(rules, proxy, "sub_frame").kind).toBe("block");
    expect(evaluate(rules, proxy, "xmlhttprequest").kind).toBe("block");
  });

  it("is not blocked at all when open, translate.goog included", () => {
    const open = effectiveState(run([ok(openPayload())]), FALLBACK);
    expect(evaluate(rulesFor(open), "https://x.translate.goog/", "main_frame").kind).toBe("none");
  });

  it("throws on an unusable launcher URL instead of producing a broken redirect", () => {
    expect(() =>
      buildRules({ locked: true, allow: [], blockAlways: [], launcherUrl: "nope", launcherHost: "x" }),
    ).toThrow();
  });

  it("planRuleUpdate removes everything installed plus our ids, then adds the new set", () => {
    const rules = rulesFor(locked);
    expect(planRuleUpdate([7, 2], rules)).toEqual({
      removeRuleIds: [1, 2, 3, 4, 7],
      addRules: rules,
    });
    expect(planRuleUpdate([], [])).toEqual({ removeRuleIds: [...MANAGED_RULE_IDS], addRules: [] });
  });
});

// ---------------------------------------------------------------------------
describe("sync: fail-closed state machine", () => {
  it("never synced -> locked, only the launcher (fallback) allowed, translate.goog blocked", () => {
    const s = effectiveState(initialSyncState(), FALLBACK);
    expect(s).toMatchObject({
      locked: true,
      reason: "never-synced",
      allow: [],
      blockAlways: ["translate.goog"],
      launcherUrl: "https://fallback-launcher.example.org",
      launcherHost: "fallback-launcher.example.org",
      openUntil: null,
    });
    const rules = rulesFor(s);
    expect(rules[2]!.condition.requestDomains).toEqual(["fallback-launcher.example.org"]);
  });

  it("never synced + failures stays launcher-only", () => {
    const s = effectiveState(run([fail, fail, fail]), FALLBACK);
    expect(s.locked).toBe(true);
    expect(s.allow).toEqual([]);
  });

  it("follows the server: open with openUntil / locked", () => {
    const open = effectiveState(run([ok(openPayload())]), FALLBACK);
    expect(open).toMatchObject({ locked: false, reason: "server-open", openUntil: "2026-10-15T12:45:00.000Z" });
    const locked = effectiveState(run([ok(payload())]), FALLBACK);
    expect(locked).toMatchObject({ locked: true, reason: "server-locked", openUntil: null });
    expect(locked.allow).toEqual([
      "dictionary.cambridge.org",
      "math-app-gules.vercel.app",
      "translate.google.com",
    ]);
    expect(locked.launcherUrl).toBe(LAUNCHER_URL);
  });

  it("one failed poll does NOT lock, but openUntil is no longer trusted", () => {
    const s = effectiveState(run([ok(openPayload()), fail]), FALLBACK);
    expect(s).toMatchObject({ locked: false, failures: 1, openUntil: null });
    expect(rulesFor(s)).toEqual([]);
  });

  it(`${FAIL_CLOSED_AFTER_FAILURES} consecutive failures -> locked with the last stored allowlist`, () => {
    const s = effectiveState(run([ok(openPayload()), fail, fail]), FALLBACK);
    expect(s).toMatchObject({ locked: true, reason: "offline", failures: 2, openUntil: null });
    expect(s.allow).toContain("math-app-gules.vercel.app");
    expect(s.launcherHost).toBe(LAUNCHER_HOST);
    const rules = rulesFor(s);
    expect(evaluate(rules, "https://math-app-gules.vercel.app/", "main_frame").kind).toBe("allow");
    expect(evaluate(rules, "https://youtube.com/", "main_frame").kind).toBe("redirect");
    // Many more failures: still locked, same allowlist.
    const later = effectiveState(run([ok(openPayload()), ...Array<SyncEvent>(50).fill(fail)]), FALLBACK);
    expect(later.locked).toBe(true);
    expect(later.allow).toEqual(s.allow);
  });

  it("failures must be consecutive: a success in between resets the count", () => {
    const s = run([ok(openPayload()), fail, ok(openPayload()), fail]);
    expect(s.failures).toBe(1);
    expect(effectiveState(s, FALLBACK).locked).toBe(false);
  });

  it("recovers as soon as a poll succeeds again", () => {
    const offline = run([ok(openPayload()), fail, fail, fail]);
    expect(effectiveState(offline, FALLBACK).locked).toBe(true);
    const back = reduceSync(offline, ok(openPayload({ openUntil: "2026-10-15T12:50:00.000Z" })));
    expect(effectiveState(back, FALLBACK)).toMatchObject({
      locked: false,
      failures: 0,
      openUntil: "2026-10-15T12:50:00.000Z",
    });
  });

  it("browser start -> locked (unconfirmed) with stored allowlist until the next successful poll", () => {
    const stored = run([ok(openPayload())]);
    const afterStart = reduceSync(stored, { type: "startup" });
    const s = effectiveState(afterStart, FALLBACK);
    expect(s).toMatchObject({ locked: true, reason: "unconfirmed", openUntil: null });
    expect(s.allow).toContain("translate.google.com");
    expect(effectiveState(reduceSync(afterStart, fail), FALLBACK).locked).toBe(true);
    expect(effectiveState(reduceSync(afterStart, ok(openPayload())), FALLBACK).locked).toBe(false);
  });

  it("openUntil alarm -> locked until the server confirms; stale alarms are ignored", () => {
    const stored = run([ok(openPayload())]);
    const ended = reduceSync(stored, { type: "openUntilReached", openUntil: "2026-10-15T12:45:00.000Z" });
    expect(effectiveState(ended, FALLBACK)).toMatchObject({ locked: true, reason: "unconfirmed" });
    expect(effectiveState(reduceSync(ended, fail), FALLBACK).locked).toBe(true);
    // Server extended the window (e.g. parent added 15'): reopened.
    const extended = reduceSync(ended, ok(openPayload({ openUntil: "2026-10-15T13:00:00.000Z" })));
    expect(effectiveState(extended, FALLBACK).locked).toBe(false);
    // An alarm for an older window does nothing.
    const stale = reduceSync(extended, { type: "openUntilReached", openUntil: "2026-10-15T12:45:00.000Z" });
    expect(stale).toEqual(extended);
  });

  it("uses the server launcherUrl over the fallback and never blocks the launcher itself", () => {
    const s = effectiveState(
      run([ok(payload({ launcherUrl: "https://launcher.example.com/today", blockAlways: ["example.com", "translate.goog"] }))]),
      FALLBACK,
    );
    expect(s.launcherUrl).toBe("https://launcher.example.com");
    expect(s.blockAlways).toEqual(["translate.goog"]);
  });

  it("always blocks translate.goog even if the server list omits it", () => {
    const s = effectiveState(run([ok(payload({ blockAlways: [] }))]), FALLBACK);
    expect(s.blockAlways).toEqual(["translate.goog"]);
  });

  it("a malformed server body is rejected (counts as a failure)", () => {
    expect(parseExtStatePayload(payload())).toEqual(payload());
    expect(parseExtStatePayload(null)).toBeNull();
    expect(parseExtStatePayload({ ...payload(), open: "true" })).toBeNull();
    expect(parseExtStatePayload({ ...payload(), allow: ["a.com", 1] })).toBeNull();
    expect(parseExtStatePayload({ ...payload(), openUntil: "soon" })).toBeNull();
    expect(parseExtStatePayload({ ...payload(), launcherUrl: "javascript:alert(1)" })).toBeNull();
    expect(parseExtStatePayload({ ...payload(), pollSeconds: 0 })).toBeNull();
    expect(parseExtStatePayload({ ...payload(), serverNow: undefined })).toBeNull();
  });

  it("unreadable storage -> never-synced (launcher only)", () => {
    expect(parseSyncState(undefined)).toEqual(initialSyncState());
    expect(parseSyncState({ v: 2 })).toEqual(initialSyncState());
    expect(parseSyncState({ v: 1, lastGood: { open: true }, failures: 0, confirmed: true })).toEqual(
      initialSyncState(),
    );
    const good = run([ok(openPayload())]);
    expect(parseSyncState(JSON.parse(JSON.stringify(good)))).toEqual(good);
    // Unknown failure count -> assume offline.
    const weird = parseSyncState({ ...good, failures: "x" });
    expect(effectiveState(weird, FALLBACK).locked).toBe(true);
  });

  it("requires a valid fallback launcher when the server has not answered yet", () => {
    expect(() => effectiveState(initialSyncState(), "not a url")).toThrow();
  });
});

// ---------------------------------------------------------------------------
describe("planAlarms", () => {
  it("polls every pollSeconds (clamped to 30..60 s) and sets an alarm at openUntil on the server clock", () => {
    expect(planAlarms(run([ok(openPayload())]))).toEqual({
      pollPeriodMinutes: 1,
      openUntil: { openUntil: "2026-10-15T12:45:00.000Z", delayInMinutes: 45 },
    });
    expect(planAlarms(run([ok(payload({ pollSeconds: 600 }))])).pollPeriodMinutes).toBe(1);
    expect(planAlarms(run([ok(payload({ pollSeconds: 5 }))])).pollPeriodMinutes).toBe(0.5);
    expect(planAlarms(initialSyncState())).toEqual({ pollPeriodMinutes: 1, openUntil: null });
  });

  it("no openUntil alarm when locked, after a failure, or when untrusted", () => {
    expect(planAlarms(run([ok(payload())])).openUntil).toBeNull();
    expect(planAlarms(run([ok(openPayload()), fail])).openUntil).toBeNull();
    expect(planAlarms(run([ok(openPayload()), { type: "startup" }])).openUntil).toBeNull();
  });

  it("an openUntil already passed on the server clock fires immediately", () => {
    const p = openPayload({ serverNow: "2026-10-15T12:46:00.000Z" });
    expect(planAlarms(run([ok(p)])).openUntil?.delayInMinutes).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe("changing the laptop clock changes nothing", () => {
  const scenario = (): unknown => {
    const events: SyncEvent[] = [{ type: "startup" }, ok(openPayload()), fail, fail, ok(openPayload())];
    const states = events.map((_, i) => run(events.slice(0, i + 1)));
    const tabs = [{ id: 1, url: "https://youtube.com/watch?v=1&t=2#c" }];
    return states.map((st) => {
      const eff = effectiveState(st, FALLBACK);
      return { eff, rules: rulesFor(eff), alarms: planAlarms(st), sweep: planTabSweep(tabs, eff) };
    });
  };

  it("gives identical results whatever the system time is", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
    const reference = scenario();
    for (const t of ["1999-01-01T00:00:00Z", "2026-10-15T23:59:59Z", "2026-10-16T08:00:00Z", "2099-12-31T00:00:00Z"]) {
      vi.setSystemTime(new Date(t));
      expect(scenario()).toEqual(reference);
    }
  });
});

// ---------------------------------------------------------------------------
describe("tab sweep", () => {
  const tabs = [
    { id: 1, url: "https://www.youtube.com/watch?v=abc&t=1#c" },
    { id: 2, url: "https://math-app-gules.vercel.app/lesson/3" },
    { id: 3, url: `${LAUNCHER_URL}/today` },
    { id: 4, url: "chrome://settings/" },
    { id: 5, url: "edge://newtab/" },
    { id: 6, url: "file:///C:/Users/an/game.html" },
    { id: 7, url: "https://x-y.translate.goog/?a=1" },
    { id: 8, url: "https://translate.google.com/", pendingUrl: "https://google.com/search?q=x" },
    { id: 9, url: "https://google.com/", pendingUrl: "https://translate.google.com/" },
    { url: "https://youtube.com/" }, // no id
    { id: 10 }, // no url (no permission / loading)
    { id: 11, url: "https://www.Dictionary.Cambridge.org./dictionary" },
  ];

  it("open -> nothing to do", () => {
    expect(planTabSweep(tabs, effectiveState(run([ok(openPayload())]), FALLBACK))).toEqual([]);
  });

  it("locked -> every tab outside the allowlist goes to the lock page with its URL", () => {
    const s = effectiveState(run([ok(payload())]), FALLBACK);
    expect(planTabSweep(tabs, s)).toEqual([
      { tabId: 1, url: buildBlockedUrl(LAUNCHER_URL, "https://www.youtube.com/watch?v=abc&t=1#c") },
      { tabId: 6, url: buildBlockedUrl(LAUNCHER_URL, "file:///C:/Users/an/game.html") },
      { tabId: 7, url: buildBlockedUrl(LAUNCHER_URL, "https://x-y.translate.goog/?a=1") },
      { tabId: 8, url: buildBlockedUrl(LAUNCHER_URL, "https://google.com/search?q=x") },
      { tabId: 9, url: buildBlockedUrl(LAUNCHER_URL, "https://google.com/") },
    ]);
  });

  it("fail-closed sweep uses the stored allowlist; never-synced sweeps everything but the launcher", () => {
    const offline = effectiveState(run([ok(openPayload()), fail, fail]), FALLBACK);
    expect(planTabSweep(tabs, offline).map((r) => r.tabId)).toEqual([1, 6, 7, 8, 9]);
    const never = effectiveState(initialSyncState(), LAUNCHER_URL);
    expect(planTabSweep(tabs, never).map((r) => r.tabId)).toEqual([1, 2, 6, 7, 8, 9, 11]);
  });

  it("shouldSweep: on switching open -> locked and when the lists change while locked", () => {
    const open = effectiveState(run([ok(openPayload())]), FALLBACK);
    const locked = effectiveState(run([ok(payload())]), FALLBACK);
    const narrower = effectiveState(run([ok(payload({ allow: ["translate.google.com"] }))]), FALLBACK);
    expect(shouldSweep(open, locked)).toBe(true);
    expect(shouldSweep(null, locked)).toBe(true);
    expect(shouldSweep(locked, locked)).toBe(false);
    expect(shouldSweep(locked, narrower)).toBe(true);
    expect(shouldSweep(locked, open)).toBe(false);
    expect(shouldSweep(null, open)).toBe(false);
    // Free time ends and the next poll fails twice -> still a switch into locked.
    const offline = effectiveState(run([ok(openPayload()), fail, fail]), FALLBACK);
    expect(shouldSweep(open, offline)).toBe(true);
  });
});
