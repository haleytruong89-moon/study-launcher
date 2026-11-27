# V1 "Luôn chặn" + Spotify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A family "Luôn chặn" list (default: AI character chat + Grok + AO3) that the laptop extension blocks **even while the laptop is open**, plus a Spotify quick-add and a warning for laptops still on an old extension.

**Architecture:** A new table `always_block_entries` holds the list. `/api/ext/state` merges it into the existing `blockAlways` field. Extension 0.4 installs the existing priority-3 block rule in the open state too, reloads open tabs on blocked domains, and reports its version in a header. The server stores the version on `extension_devices`, and the parent's Thiết bị page warns about old versions. No lock/unlock rule changes otherwise.

**Tech Stack:** Next.js App Router, TypeScript strict, Supabase (SQL migration + RLS), Chrome MV3 `declarativeNetRequest`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-27-vi-gio-choi-design.md` §5.9, §14 (V1), D11, D12, D16, C13.

## Global Constraints

- Migration `supabase/migrations/0031_always_block.sql`: additive, idempotent, one transaction, grant + RLS in the same file, no drop/truncate/delete; RLS test added to `supabase/tests/rls_test.sql`; run `bash scripts/test-db.sh`.
- Default list (D11, D16): `character.ai`, `c.ai`, `janitorai.com`, `grok.com`, `archiveofourown.org`, `ao3.org`. Family-wide, the parent can remove any row.
- `translate.goog` stays built-in in the extension, as today.
- Old extensions (< 0.4.0) are **warned about, never locked** (C13).
- Spotify domain: `spotify.com` (covers `open.spotify.com`, `accounts.spotify.com`). No YouTube / YouTube Music. *(Changed while building: D12 says "Spotify luôn mở", so 0031 also adds `spotify.com` as a default family-wide study site, like 0016; the quick-add stays.)*
- Open state: no rule when the family list is empty (as before); otherwise the whole list incl. `translate.goog`, which would proxy a blocked site. *(Decided after review.)*
- UI text Vietnamese, code/comments/commits English. Buttons ≥ 44px.
- `npm run typecheck && npm run lint && npm test` green before each commit.
- One branch `feature/v1-luon-chan`, one PR into `main`. Do not merge.

## Review Focus

- **Blocked domain the parent also allowed** (e.g. `archiveofourown.org` in Trang học): block wins in both open and locked states. Test in Task 2 (`buildRules` open with an allow entry still blocks) and Task 1 (payload keeps both lists).
- **Parent blocks the Launcher's own host or `accounts.google.com`**: the extension already ignores blockAlways entries covering the launcher host (`sync.ts`). The route must refuse the launcher host and `accounts.google.com` so sign-in never breaks. Test in Task 3.
- **Child asks "Xin mở" for a blocked site**: the request route refuses with "Trang này bố mẹ đã chặn hẳn." instead of creating a request the parent might approve to no effect. Test in Task 3.
- **Tab already open on a blocked site when the list arrives or the laptop opens**: that tab is reloaded and hits the block. Test in Task 2 (`planBlockedTabReloads`).
- **Extension never sent a version (≤ 0.3.5) or sent garbage**: treated as outdated; the warning shows; nothing locks. Test in Task 3 (`isOutdatedExtension(null)`, `("abc")`).

---

### Task 1: Data + server payload

**Files:**
- Create: `supabase/migrations/0031_always_block.sql`
- Modify: `supabase/tests/rls_test.sql`
- Modify: `lib/ext/payload.ts` (`extStateBody`)
- Modify: `app/api/ext/state/route.ts`
- Test: `tests/extPayload.test.ts`

**Interfaces:**
- Produces: table `public.always_block_entries(id uuid pk, family_id uuid not null → families on delete cascade, domain text not null, created_by uuid → profiles on delete set null, created_at timestamptz default now(), unique (family_id, domain))`; column `public.extension_devices.ext_version text`.
- Produces: `extStateBody(state: DayState, allow: string[], launcherUrl: string, allowLocalFiles = false, familyBlock: string[] = []): ExtStateBody` — `blockAlways` = sorted unique `["translate.goog", ...familyBlock normalised]`.
- Produces: `/api/ext/state` reads header `x-extension-version` and, in the existing `after()` update, writes `ext_version` when it matches `/^\d+\.\d+\.\d+$/`.

- [ ] **Step 1: Write the failing payload tests** in `tests/extPayload.test.ts`:
  - `extStateBody(..., [], ...).blockAlways` equals `["translate.goog"]` (unchanged default).
  - `extStateBody(state, ["archiveofourown.org"], url, false, ["Character.AI", "grok.com", "grok.com"]).blockAlways` equals `["character.ai", "grok.com", "translate.goog"]`, and `.allow` still contains `"archiveofourown.org"`.
- [ ] **Step 2: Run** `npx vitest run tests/extPayload.test.ts` → FAIL (extra parameter ignored).
- [ ] **Step 3: Implement** the new parameter with `normalizeDomain` from `lib/admin/schemas.ts`; drop entries that normalise to null.
- [ ] **Step 4: Write migration 0031**:
  - Table, RLS enabled, `grant select, insert, delete on public.always_block_entries to authenticated`, `grant all … to service_role`; policies following 0026's pattern: parent select / insert / delete for their family only; **no** child policy (children never read it; the server reads with service_role).
  - Insert the six default domains for every existing family where missing (pattern of 0016 §2).
  - `create or replace function public.seed_family_defaults(...)`: copy 0016's body exactly, then add the same six inserts into `always_block_entries`; keep the revoke/grant lines.
  - `alter table public.extension_devices add column if not exists ext_version text; grant select (ext_version) on public.extension_devices to authenticated;`
- [ ] **Step 5: Add RLS tests** to `supabase/tests/rls_test.sql`: a parent sees and deletes their family's rows; a parent of another family sees 0 rows; a child sees 0 rows and cannot insert; re-running 0031 adds no duplicate rows.
- [ ] **Step 6: Run** `bash scripts/test-db.sh` → all pass.
- [ ] **Step 7: Route**: in `app/api/ext/state/route.ts`, add `admin.from("always_block_entries").select("domain").eq("family_id", device.family_id)` to the existing `Promise.all`; on error log and use `[]` (an error must not fail the poll, since that would lock the laptop: same policy as the 0007 settings read). Pass domains to `extStateBody`. Store `ext_version` as above.
- [ ] **Step 8: Run** `npm run typecheck && npm run lint && npm test` → green.
- [ ] **Step 9: Commit** `feat: always-block list in the extension payload (0031)`.

### Task 2: Extension 0.4

**Files:**
- Modify: `extension/src/core/rules.ts` (`buildRules`)
- Modify: `extension/src/core/sweep.ts` (add `planBlockedTabReloads`)
- Modify: `extension/src/background.ts` (version header; reload tabs while open)
- Modify: `extension/manifest.json` (`"version": "0.4.0"`)
- Test: `tests/extensionCore.test.ts`

**Interfaces:**
- Consumes: `blockAlways` from the payload (Task 1), already merged with `BUILTIN_BLOCK_ALWAYS` in `sync.ts`.
- Produces: `buildRules(input)` when `locked === false` returns exactly one rule `{ id: RULE_IDS.blockAlways, priority: 3, action: { type: "block" }, condition: { requestDomains: blockAlways, resourceTypes: ALL_RESOURCE_TYPES } }`, or `[]` if `blockAlways` is empty. Locked output unchanged.
- Produces: `planBlockedTabReloads(tabs: readonly TabLike[], state: EffectiveState): number[]` — when `state.locked === false`, the ids of tabs whose `url` or `pendingUrl` host matches `state.blockAlways` (`hostMatchesAny`); when locked, `[]` (the existing sweep covers it).

- [ ] **Step 1: Write failing tests**:
  - `buildRules({ locked: false, blockAlways: ["character.ai","translate.goog"], allow: ["archiveofourown.org"], … })` has length 1, rule id 3, priority 3, block, domains `["character.ai","translate.goog"]`.
  - `buildRules({ locked: false, blockAlways: [], … })` equals `[]`.
  - Existing locked-state tests unchanged.
  - `planBlockedTabReloads` open: tabs `https://beta.character.ai/chat`, `https://docs.google.com/x`, `chrome://newtab` → `[id of character.ai tab]`; locked → `[]`.
- [ ] **Step 2: Run** `npx vitest run tests/extensionCore.test.ts` → FAIL.
- [ ] **Step 3: Implement** both functions; update the doc comment at the top of `rules.ts` ("Open: only the always-block rule").
- [ ] **Step 4: Background**: add header `"X-Extension-Version": chrome.runtime.getManifest().version` to the `/api/ext/state` fetch; after rules are applied in the open state, call `chrome.tabs.query({})` → `planBlockedTabReloads` → `chrome.tabs.reload(id)` for each (errors swallowed, as for the sweep). Bump manifest to `0.4.0`.
- [ ] **Step 5: Run** `npm run typecheck && npm run lint && npm test` and `npm run build` (prebuild packs the zip) → green, zip contains version 0.4.0.
- [ ] **Step 6: Commit** `feat(extension): 0.4 blocks the always-block list while open`.

### Task 3: Parent screens + request guard + Spotify

**Files:**
- Create: `app/api/admin/blocklist/route.ts` (POST), `app/api/admin/blocklist/[id]/route.ts` (DELETE)
- Create: `lib/admin/blocklist.ts`
- Create: `lib/ext/version.ts`
- Modify: `app/parent/allowlist/page.tsx` (+ section "Luôn chặn" with add form and remove buttons, reusing `allow-forms.tsx` patterns)
- Modify: `app/parent/devices/page.tsx` (warning line)
- Modify: `lib/admin/presets.ts` (Spotify)
- Modify: the child "Xin mở trang" route under `app/api/unlock-requests/`
- Test: `tests/blocklist.test.ts`, `tests/extVersion.test.ts`, `tests/presets.test.ts`

**Interfaces:**
- Produces: `blockDomainProblem(domain: string, launcherHost: string | null): string | null` in `lib/admin/blocklist.ts` — `null` when OK; Vietnamese message for: invalid domain, the launcher host (or a parent of it), `accounts.google.com` / `google.com`.
- Produces: `isOutdatedExtension(version: string | null, min = "0.4.0"): boolean` in `lib/ext/version.ts` — numeric semver compare; `null` / malformed → `true`.
- Produces: `PRESETS` gains `{ id: "spotify", label: "Spotify", sub: "Nghe nhạc khi học (không có video)", domains: ["spotify.com"] }`; the `Preset["id"]` union gains `"spotify"`.
- Routes: `POST /api/admin/blocklist {domain}` → `requireParent`, `domainFromInput`, `blockDomainProblem`, insert (ignore duplicate), `writeAudit(ctx, "blocklist.add", {domain})`. `DELETE /api/admin/blocklist/:id` → own family only, `writeAudit(ctx, "blocklist.remove", {domain})`. Add both kinds to `lib/admin/auditText.ts`.

- [ ] **Step 1: Write failing tests**:
  - `blockDomainProblem("grok.com", "study-launcher-nine.vercel.app")` → `null`; `("study-launcher-nine.vercel.app", same)` → message; `("vercel.app", same)` → message; `("accounts.google.com", …)` and `("google.com", …)` → message; `("not a domain", …)` → message.
  - `isOutdatedExtension("0.4.0")` false; `("0.10.1")` false; `("0.3.5")` true; `(null)` true; `("abc")` true.
  - `presetById("spotify")?.domains` equals `["spotify.com"]`; existing presets test still passes.
- [ ] **Step 2: Run** the three test files → FAIL.
- [ ] **Step 3: Implement** the two helpers and the preset.
- [ ] **Step 4: Implement** the two routes and the "Luôn chặn" section on Trang học. Copy: heading "Luôn chặn", sub-line "Chặn cả lúc máy đang mở (giờ chơi, Tin tưởng, ngày ốm). Cần extension 0.4 trở lên.", input placeholder "vd grok.com", remove button "Bỏ chặn".
- [ ] **Step 5: Request guard**: in the child's "Xin mở trang" route, after the domain is parsed, if its host matches any family `always_block_entries` domain (`hostMatchesDomain` logic, server copy in `lib/admin/blocklist.ts` as `isBlockedHost(host: string, domains: string[]): boolean`), respond 400 `"Trang này bố mẹ đã chặn hẳn."` and do not insert or push. Add an `isBlockedHost` case to `tests/blocklist.test.ts` (`"beta.character.ai"` vs `["character.ai"]` → true; `"notcharacter.ai"` → false).
- [ ] **Step 6: Devices page**: select `ext_version`; under each active device show `Extension {version ?? "cũ"} — lúc mở máy chưa chặn trang trong "Luôn chặn". Tải bản mới ở Thêm › Thiết bị rồi cài lại.` when `isOutdatedExtension(ext_version)`.
- [ ] **Step 7: Run** `npm run typecheck && npm run lint && npm test` → green.
- [ ] **Step 8: Commit** `feat: Luôn chặn list for parents, Spotify quick-add, old-extension warning`.

### Task 4: Docs + PR

**Files:**
- Modify: `docs/SPEC.md` §18 (one line, 27/11/2026, V1), `docs/DESIGN.md` §7 (open state now installs the always-block rule; version header), `CLAUDE.md` Key decisions (one line), `docs/PROGRESS.md` (one row; SQL 0031).

- [ ] **Step 1:** Write the doc lines (Vietnamese, short), citing the spec path.
- [ ] **Step 2:** Push the branch, open the PR with `gh api repos/haleytruong89-moon/study-launcher/pulls` (REST). PR description (Vietnamese): làm gì · cách thử trên preview (Trang học → thấy 6 dòng Luôn chặn, thêm/bỏ một dòng; Thêm nhanh Spotify; Thiết bị → laptop chạy bản cũ có dòng cảnh báo; sau khi merge: tải extension mới, cài lại, mở `character.ai` lúc đang giờ tự do → bị chặn) · **Có đụng database: có, 0031** (bảng mới, 6 dòng mặc định cho gia đình, cột `ext_version`; chỉ thêm) · tiêu chí đã đạt.
- [ ] **Step 3:** Commit `docs: V1 always-block list`.
