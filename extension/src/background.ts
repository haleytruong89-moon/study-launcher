/// <reference types="chrome" />
/**
 * Background service worker (S4b): wires the pure core (src/core) to chrome.* APIs.
 * Decisions confirmed by the parent on 17/10/2026 (see src/core/sync.ts):
 *  1. browser start -> locked until the first successful poll;
 *  2. openUntil reached -> locked at once (the local timer only ever locks EARLIER);
 *  3. 2 failed polls in a row -> locked with the last allowlist;
 *  4. file: tabs are sent to the lock page while locked.
 * Everything is serialised through one promise chain so events never interleave.
 */
import { EXT_SOURCE, LAUNCHER_URL, TOKEN_RE } from "./config";
import {
  buildRules,
  effectiveState,
  initialSyncState,
  parseExtStatePayload,
  parseSyncState,
  planAlarms,
  planRuleUpdate,
  planTabSweep,
  reduceSync,
  type EffectiveState,
  type SyncEvent,
  type SyncState,
} from "./core";

const ALARM_POLL = "poll";
const ALARM_OPEN = "openUntil|";

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

async function enforce(sync: SyncState): Promise<EffectiveState> {
  const eff = effectiveState(sync, LAUNCHER_URL);
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const update = planRuleUpdate(
    existing.map((r) => r.id),
    buildRules(eff),
  );
  await chrome.declarativeNetRequest.updateDynamicRules(update as unknown as chrome.declarativeNetRequest.UpdateRuleOptions);
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
  try {
    const res = await fetch(`${LAUNCHER_URL}/api/ext/state`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
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
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (!info.url) return;
  void (async () => {
    const r = await chrome.storage.local.get("lastEffective");
    const eff = r.lastEffective as EffectiveState | undefined;
    if (!eff?.locked) return;
    for (const t of planTabSweep([{ ...tab, id: tabId, url: info.url }], eff)) await chrome.tabs.update(t.tabId, { url: t.url }).catch(() => undefined);
  })();
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
      const ok = await poll();
      sendResponse({ source: EXT_SOURCE, ok });
    });
    return true;
  }
  return false;
});

// The worker may wake for any event: make sure the poll alarm exists.
void ensurePollAlarm();
