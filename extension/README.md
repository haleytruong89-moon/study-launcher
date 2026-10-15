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

## Missing (S4b and later)

- Background service worker wiring: alarms (poll every `pollSeconds`, alarm at
  `openUntil` using `planAlarms`), `fetch` of `GET /api/ext/state` with the device
  token, `chrome.storage.local` persistence, `updateDynamicRules`, tab sweep,
  `runtime.onStartup` → open a Launcher tab, `tabs.onUpdated` check for `file:` tabs.
- Pairing via `externally_connectable` (`{type:'pair', token, apiBase}`); the
  `matches` entry is a placeholder (`https://launcher.invalid/*`) to be filled from
  `NEXT_PUBLIC_APP_URL` by the build.
- New-tab page (redirects to the Launcher), popup (status + "Mở Launcher").
- Build (esbuild/Vite → `extension/dist/`), store packaging (unlisted, S6).
- Server side: `/api/ext/pair`, `/api/ext/state`, the `/blocked` page.

## To verify in a real browser (S4b)

- Whether the DNR redirect URL still contains the `#fragment` of the original URL
  (the network request URL may drop it; the tab sweep always keeps it).
- Chrome clamps alarms to ≥ 30 s for packed extensions; `planAlarms` returns the
  exact delay and the worker should accept the clamp.
- Internal pages are never redirected; block games like `chrome://dino` with the
  `URLBlocklist` policy (docs/SETUP.md) if needed.
