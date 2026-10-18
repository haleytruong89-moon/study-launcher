# Study Launcher — browser extension (Chrome + Edge, MV3)

Design: `docs/DESIGN.md` §7 (source of truth), acceptance criteria: `docs/SPEC.md` §2.6 "Khóa web".

## What exists (S4a)

Pure TypeScript logic in `src/core/` — no `chrome.*` calls, no clock — tested by
`tests/extension*.test.ts` (Vitest):

| File | What it does |
|---|---|
| `domains.ts` | Hostname normalisation (lowercase, IDN → punycode, ports / trailing dots / `*.` stripped) and `isAllowed(url, allow, blockAlways, launcherHost)`. An entry allows itself + subdomains; `blockAlways` (always incl. `translate.goog`) wins; launcher always allowed; internal pages (`chrome://`, `edge://`, `about:`, extension pages) never hijacked; `file:`, `data:`, `view-source:` … blocked while locked. |
| `rules.ts` | `declarativeNetRequest` dynamic rules. Locked: (1) redirect every http(s) `main_frame` to `<launcher>/blocked?u=<url>` (prio 1), (2) allow allowlist + launcher (prio 2), (3) block blockAlways, all resource types (prio 3). Open: no rules. Stable ids 1–3, `planRuleUpdate` for `updateDynamicRules`. |
| `sync.ts` | Fail-closed state machine: `reduceSync(state, event)`, `effectiveState(state, fallbackLauncherUrl)`, `planAlarms(state)`, payload/storage validation. ≥ 2 consecutive failed polls → locked with the stored allowlist; never synced → launcher only; browser start or `openUntil` alarm → locked until the next successful poll. |
| `sweep.ts` | `planTabSweep(tabs, state)` — which tabs to send to the lock page; `shouldSweep(prev, next)`. |
| `blockedUrl.ts` | Build / parse `/blocked?u=<raw url>`; the original URL is not encoded, read everything after `?u=`. |

`manifest.json` declares the permissions from DESIGN §7. It references files that
do not exist yet (`background.js`, `newtab.html`, `popup.html`), so the extension
cannot be loaded yet.

## Wired in S4b

- `src/background.ts`: alarms (poll every 30 s, one-shot at `openUntil`), `GET /api/ext/state`
  with the device token, `chrome.storage.local`, `updateDynamicRules`, tab sweep on every
  locked state, `onStartup` → "startup" event + a Launcher tab, `tabs.onUpdated` for `file:`.
- `src/content.ts`: only on the Launcher domain (fixed at build); relays `/ghep-may`'s
  `window.postMessage({source:'study-launcher-page', type:'ping'|'pair'})` to the worker.
- New tabs → `/today` via `tabs.onCreated` (no new-tab override: browsers offer a one-click undo), `src/popup.ts` (status + "Mở việc hôm nay").
- Build: `npm run ext:build` (also runs before `npm run build`) → `extension/dist/` and
  `public/downloads/study-launcher-extension.zip`. The Launcher URL comes from
  `NEXT_PUBLIC_APP_URL` (fallback: production).
- Still later: store packaging (unlisted) + force-install policy (S6), icons.

## Checked in a real browser (S4b, Chromium + mock server)

- Not paired → locked, only the Launcher; pairing via `/ghep-may` works; locked navigation
  goes to `/blocked?u=…` **with** the `#fragment`; allowlisted hosts are not redirected;
  `translate.goog` is blocked; open → nothing redirected; locking again sweeps open tabs.

## Still to verify on the children's laptops

- Whether the DNR redirect URL still contains the `#fragment` of the original URL
  (the network request URL may drop it; the tab sweep always keeps it).
- Chrome clamps alarms to ≥ 30 s for packed extensions; `planAlarms` returns the
  exact delay and the worker should accept the clamp.
- Internal pages are never redirected; block games like `chrome://dino` with the
  `URLBlocklist` policy (docs/SETUP.md) if needed.
