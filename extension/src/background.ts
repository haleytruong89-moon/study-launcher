/// <reference types="chrome" />
/**
 * Background service worker (S4b): wires the pure core (src/core) to chrome.* APIs.
 * Decisions confirmed by the parent on 17/10/2026 (see src/core/sync.ts):
 *  1. browser start -> locked until the first successful poll;
 *  2. openUntil reached -> locked at once (the local timer only ever locks EARLIER);
 *  3. 2 failed polls in a row -> locked with the last allowlist;
 *  5. (audit 24/10) no access to all sites ("Site access: On click") -> locked, the
 *     catch-all becomes a plain block (a redirect needs site access, a block does not);
 *  4. file: tabs are sent to the lock page while locked (24/10/2026: saved .html/.htm/.pdf
 *     stay open when the parent turns on "allowLocalFiles").
 * Blocked same-site frames inside a study page are reported to the parent (see the end).
 * Everything is serialised through one promise chain so events never interleave.
 */
import { EXT_SOURCE, LAUNCHER_URL, TOKEN_RE } from "./config";
import {
  buildRules,
  effectiveState,
  frameReport,
  initialSyncState,
  parseExtStatePayload,
  parseSyncState,
  planAlarms,
  planRuleUpdate,
  planTabSweep,
  reduceSync,
  tokenProof,
  uninstallUrl,
  withHostAccess,
  type EffectiveState,
  type SyncEvent,
  type SyncState,
} from "./core";

const ALARM_POLL = "poll";
const ALARM_OPEN = "openUntil|";
/** A poll that does not answer within this time counts as FAILED (never leaves us open). */
const POLL_TIMEOUT_MS = 10_000;
/** While open, a navigation also triggers a poll at most this often (alarms follow the laptop clock). */
const NAV_POLL_MS = 30_000;
let lastPollAt: number | null = null;
const NEW_TAB = /^(chrome|edge):\/\/(newtab|new-tab-page)\/?$/;

interface Stored {
  sync: SyncState;
  token: string | null;
}

async function load(): Promise<Stored> {
  try {
    const r = await chrome.storage.local.get(["sync", "token"]);
    return { sync: parseSyncState(r.sync), token: typeof r.token === "string" && TOKEN_RE.test(r.token) ? r.token : null };
  } catch {
    return { sync: initialSyncState(), token: null }; // unreadable storage -> never synced -> locked
  }
}

let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

async function installRules(rules: ReturnType<typeof buildRules>) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const update = planRuleUpdate(
    existing.map((r) => r.id),
    rules,
  );
  await chrome.declarativeNetRequest.updateDynamicRules(update as unknown as chrome.declarativeNetRequest.UpdateRuleOptions);
}

/** Access to every site ("Site access: On all sites"). Unknown -> false (fail closed). */
async function hasHostAccess(): Promise<boolean> {
  return chrome.permissions.contains({ origins: ["<all_urls>"] }).catch(() => false);
}

async function enforce(sync: SyncState): Promise<EffectiveState> {
  let eff = withHostAccess(effectiveState(sync, LAUNCHER_URL), await hasHostAccess());
  try {
    await installRules(buildRules(eff));
  } catch {
    // Could not install the wanted rules (e.g. a bad allowlist entry): fail closed with
    // the Launcher only, never leave older (possibly open) rules in place.
    eff = { ...eff, locked: true, allow: [], openUntil: null };
    await installRules(buildRules(eff)).catch(() => undefined);
  }
  if (eff.locked) {
    // Idempotent: also catches tabs the network rules cannot see (file:, already open tabs).
    const tabs = await chrome.tabs.query({});
    for (const t of planTabSweep(tabs, eff)) await chrome.tabs.update(t.tabId, { url: t.url }).catch(() => undefined);
  }
  await chrome.storage.local.set({ lastEffective: eff });
  await chrome.action.setBadgeText({ text: eff.locked ? "" : "MỞ" }).catch(() => undefined);
  await chrome.action.setBadgeBackgroundColor({ color: "#B85A1C" }).catch(() => undefined);
  return eff;
}

async function apply(event: SyncEvent | null, replanAlarms: boolean): Promise<SyncState> {
  const { sync } = await load();
  const next = event ? reduceSync(sync, event) : sync;
  await chrome.storage.local.set({ sync: next });
  if (replanAlarms) {
    const plan = planAlarms(next);
    await chrome.alarms.create(ALARM_POLL, { periodInMinutes: plan.pollPeriodMinutes });
    for (const a of await chrome.alarms.getAll()) if (a.name.startsWith(ALARM_OPEN)) await chrome.alarms.clear(a.name);
    // Chrome may fire a few seconds late (minimum ~30 s); the next poll is never later than 30-60 s anyway.
    if (plan.openUntil) await chrome.alarms.create(ALARM_OPEN + plan.openUntil.openUntil, { delayInMinutes: Math.max(plan.openUntil.delayInMinutes, 0.5) });
  }
  await enforce(next);
  return next;
}

async function poll(): Promise<boolean> {
  const { token } = await load();
  if (!token) {
    await apply(null, false); // not paired: locked, only the Launcher (to pair) is reachable
    return false;
  }
  lastPollAt = performance.now();
  try {
    const incognito = await chrome.extension.isAllowedIncognitoAccess().catch(() => null);
    const res = await fetch(`${LAUNCHER_URL}/api/ext/state`, {
      headers: { Authorization: `Bearer ${token}`, ...(incognito === null ? {} : { "X-Incognito-Allowed": incognito ? "1" : "0" }) },
      cache: "no-store",
      signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
    });
    if (res.status === 401) {
      // Token removed by the parent (or unknown): lock at once, not after a second failure.
      await apply({ type: "pollFailed" }, false);
      await apply({ type: "pollFailed" }, false);
      return false;
    }
    const payload = res.ok ? parseExtStatePayload(await res.json()) : null;
    if (!payload) throw new Error(`bad response ${res.status}`);
    payload.launcherUrl = LAUNCHER_URL; // the lock page always stays on our own Launcher
    await apply({ type: "pollSucceeded", payload }, true);
    return true;
  } catch {
    await apply({ type: "pollFailed" }, false);
    return false;
  }
}

/**
 * S6 (01/11/2026): when the extension is removed, the browser opens our "đã gỡ" route so the
 * server can tell the parents. The address holds only the token's SHA-256 (never the token).
 * Not paired -> "" (nothing opens). Never throws: this must not affect locking.
 */
async function syncUninstallUrl(): Promise<void> {
  try {
    const { token } = await load();
    const url = uninstallUrl(LAUNCHER_URL, token ? await tokenProof(token) : null);
    await chrome.runtime.setUninstallURL(url);
  } catch {
    /* best effort only */
  }
}

async function ensurePollAlarm() {
  if (!(await chrome.alarms.get(ALARM_POLL))) await chrome.alarms.create(ALARM_POLL, { periodInMinutes: 0.5 });
}

chrome.runtime.onInstalled.addListener((details) => {
  void serial(async () => {
    await apply(null, false);
    await ensurePollAlarm();
    await poll();
    if (details.reason === "install") await chrome.tabs.create({ url: `${LAUNCHER_URL}/ghep-may` });
  });
});

chrome.runtime.onStartup.addListener(() => {
  void serial(async () => {
    await apply({ type: "startup" }, false);
    await ensurePollAlarm();
    await poll();
    await chrome.tabs.create({ url: `${LAUNCHER_URL}/today` });
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_POLL) void serial(poll);
  else if (alarm.name.startsWith(ALARM_OPEN)) {
    const openUntil = alarm.name.slice(ALARM_OPEN.length);
    void serial(async () => {
      await apply({ type: "openUntilReached", openUntil }, false);
      await poll();
    });
  }
});

// A tab navigating to something the network rules cannot catch (file:, data:) while locked.
// While open, navigations also poll (throttled): alarms follow the laptop clock, so a clock
// moved backwards would otherwise stop the polls.
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (!info.url) return;
  if (NEW_TAB.test(info.url)) {
    void chrome.tabs.update(tabId, { url: `${LAUNCHER_URL}/today` }).catch(() => undefined);
    return;
  }
  void (async () => {
    const r = await chrome.storage.local.get("lastEffective");
    const eff = r.lastEffective as EffectiveState | undefined;
    if (eff && !eff.locked) {
      if (lastPollAt === null || performance.now() - lastPollAt > NAV_POLL_MS) void serial(poll);
      return;
    }
    if (!eff?.locked) return;
    for (const t of planTabSweep([{ ...tab, id: tabId, url: info.url }], eff)) await chrome.tabs.update(t.tabId, { url: t.url }).catch(() => undefined);
  })();
});

// New tabs open the child's "Hôm nay" (instead of a new-tab override, which browsers
// offer to undo with one click).
chrome.tabs.onCreated.addListener((tab) => {
  const url = tab.pendingUrl ?? tab.url ?? "";
  if (tab.id !== undefined && NEW_TAB.test(url)) void chrome.tabs.update(tab.id, { url: `${LAUNCHER_URL}/today` }).catch(() => undefined);
});

// Pairing messages relayed by the content script (only on the Launcher's own pages).
chrome.runtime.onMessage.addListener((msg: { type?: string; token?: unknown }, sender, sendResponse) => {
  const fromLauncher = sender.id === chrome.runtime.id && typeof sender.url === "string" && sender.url.startsWith(`${LAUNCHER_URL}/`);
  if (!fromLauncher) return false;
  if (msg?.type === "ping") {
    void load().then(({ token }) => sendResponse({ source: EXT_SOURCE, paired: token !== null }));
    return true;
  }
  if (msg?.type === "pair" && typeof msg.token === "string" && TOKEN_RE.test(msg.token)) {
    const token = msg.token;
    void serial(async () => {
      await chrome.storage.local.set({ token, sync: initialSyncState() });
      await syncUninstallUrl();
      const ok = await poll();
      sendResponse({ source: EXT_SOURCE, ok });
    });
    return true;
  }
  return false;
});

// The worker may wake for any event: make sure the poll alarm exists, and the uninstall
// address matches the stored token (also covers laptops paired before 0.3.3).
void ensurePollAlarm();
void syncUninstallUrl();

// ---------------------------------------------------------------------------
// Blocked frames inside study pages (parent decision 24/10/2026): report them so the parent
// can add the missing piece with one tap. Same-site frames only (see core/frames.ts);
// each host at most once an hour, and at most 20 reports per worker life.
// ---------------------------------------------------------------------------
const reported = new Map<string, number>();
let reportsLeft = 20;
const REPORT_EVERY_MS = 60 * 60_000;

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (details.error !== "net::ERR_BLOCKED_BY_CLIENT" || reportsLeft <= 0) return;
    void (async () => {
      const r = await chrome.storage.local.get(["lastEffective"]).catch(() => ({}) as Record<string, unknown>);
      const eff = (r as { lastEffective?: EffectiveState }).lastEffective;
      if (!eff) return;
      const report = frameReport(eff, details.initiator, details.url);
      if (!report) return;
      const last = reported.get(report.frameHost);
      if (last !== undefined && performance.now() - last < REPORT_EVERY_MS) return;
      reported.set(report.frameHost, performance.now());
      reportsLeft--;
      const { token } = await load();
      if (!token) return;
      await fetch(`${LAUNCHER_URL}/api/ext/frame-block`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ page: report.page, frame: report.frame }),
        signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
      }).catch(() => undefined);
    })();
  },
  { urls: ["<all_urls>"], types: ["sub_frame"] },
);

// Audit 24/10: site access can be taken away (or given back) in the extension's details
// page at any time; re-apply at once instead of waiting for the next poll.
chrome.permissions.onRemoved.addListener(() => void serial(() => apply(null, false)));
chrome.permissions.onAdded.addListener(() => void serial(() => apply(null, false)));
