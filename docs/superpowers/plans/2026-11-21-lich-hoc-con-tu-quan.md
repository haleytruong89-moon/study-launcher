# Lịch học do con tự quản — Implementation Plan (Lát 1 + Lát 2; Lát 3 lộ trình)

> **For agentic workers:** Implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The child keeps their own timetable, extra classes (học thêm / gia sư) and subject list in
Góc học tập. The app uses this data to show "Chuẩn bị cho ngày mai" with tick boxes, and to suggest
finishing the tutor's app homework (English OS, later the Toán app) before the next class. Parents
see every change and can restore the previous version.

**Architecture:**
- Two new tables (`extra_classes`, `subject_prefs`) plus one nullable column on `timetables`.
  Lát 2 adds a third table (`prep_checks`).
- The child writes only through new server routes, which use service_role after checking the
  session. RLS still gives the child SELECT only. Every child write logs one `audit_log` entry
  holding a `before` snapshot. The parent's restore route reads that snapshot and puts it back.
- All rules are pure functions (`lib/schedule/*.ts`, `lib/timetable/rules.ts`) with Vitest tests.
  The screens only display. Nothing touches `computeDayState` rules, lock/open, free time or the
  allowlist.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind, Supabase (Postgres + RLS), Zod, Vitest, Playwright.

**Spec:** hub `deliverables/study-launcher/DE_XUAT_LICH_HOC_CON_TU_QUAN_2026-11-21.md` (parent decisions 21/11/2026) +
design canvas https://claude.ai/artifact/1bWKScuaxLrS1nDFEgLi5a (6 screens).

## Global Constraints

- CLAUDE.md rules hold, verbatim:
  - "Server quyết định, client chỉ hiển thị."
  - "Fail-closed".
  - "Không đổi hành vi khóa/mở, thứ tự ưu tiên trạng thái (DESIGN §5), allowlist mặc định".
- Parent decision 21/11/2026, which changes the child's write rights for these tables only:
  **"Con tự sửa, áp dụng ngay. Bố mẹ được báo và khôi phục được bản trước."** The child still
  never gets INSERT/UPDATE grants. Writes go through `/api/schedule/*`, which uses service_role
  after `requireChild()`.
- Học thêm is display only. It never becomes a task and never changes "đã xong", lock/open or
  free time.
- Uniform rules (decision 21/11):
  - **Nguyên:** "T2 và T6 mặc áo đồng phục lớp; ngày có tiết Thể dục mặc đồng phục thể dục
    (áo xanh lá); các ngày còn lại mặc áo trắng". Stored as weekday texts plus key `pe`. **PE wins.**
  - **An:** fixed per weekday (no `pe` key).
- Bring list per subject: the child edits it. Default suggestions come from code
  (`defaultBring`). Default for every subject: "sách + vở".
- "Làm trước" rule (parent 21/11, 17:05): "khi hôm sau là buổi học tiếng Anh thì … nên hoàn thành
  bài tập trong English OS trước vì cô giao bài trên đó; môn Toán … nếu xong thì cũng cần hoàn
  thiện bài tập toán trên đó trước".
  - It is a **suggestion + order**, not a lock rule.
  - It applies to an extra class that starts later today, or tomorrow.
- Migrations:
  - Idempotent, additive, one transaction.
  - Explicit grants, RLS and policies in the same file.
  - No drop/truncate/delete.
  - Never edit 0001–0024.
  - Next numbers: `0025`, `0026`.
- Code, comments and commits in English. Screen copy in Vietnamese. Buttons ≥ 44px.
- Never run SQL on the real Supabase, never merge, never force-push, never run prettier. One lát = one PR into `main`.
- Commit trailer:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01NAkxdahM8XSzZ9CiH26uXT
  ```
- Checks before each PR:
  - `npm run typecheck && npm run lint && npm test`
  - SQL: `TEST_DB_NAME=x PGHOST=/tmp PGPORT=5433 PGUSER=postgres bash scripts/test-db.sh`
  - e2e runs in CI.
- Weekday numbers:
  - Timetable `day` uses 1..6 = Thứ 2..Thứ 7, as in 0022.
  - Extra-class `day` uses 1..7, where 7 = Chủ nhật (matches `isoWeekday`).

---

# LÁT 1 — Lịch học con tự sửa (branch `feature/s-lh1-lich-hoc`, SQL 0025)

## File map (Lát 1)

| File | Responsibility |
|---|---|
| `supabase/migrations/0025_child_schedule.sql` | `extra_classes`, `subject_prefs`, `timetables.updated_by` |
| `supabase/tests/rls_test.sql` | RLS block for the two tables |
| `lib/timetable/rules.ts` (modify) | subject groups (Thể dục, Mỹ thuật, Âm nhạc), `uniformFor` (PE rule), `validateData`, quick text `ĐỒNG PHỤC THỂ DỤC:` |
| `lib/schedule/rules.ts` (new, pure) | extra classes: types, `normClock`, `cleanSessions`, `sessionsText`, `dayShort`, busy/`conflicts`, `extrasOn`, `diffPeriods`, `defaultBring`, `subjectRows` |
| `lib/schedule/load.ts` (new, server) | `loadSchedule(db, childIds)` |
| `lib/schedule/write.ts` (new, server) | `scheduleAudit`, snapshot helpers, `restoreFromAudit` |
| `app/api/schedule/route.ts` | GET (child): versions, extras, prefs, slots |
| `app/api/schedule/timetable/route.ts` | POST (child): save a timetable version |
| `app/api/schedule/extra/route.ts` | POST (child): save an extra class · DELETE: turn it off |
| `app/api/schedule/subject/route.ts` | POST (child): colour + bring list of one subject |
| `app/api/admin/schedule/restore/route.ts` | POST (parent): restore the `before` of one audit entry |
| `lib/admin/auditText.ts` (modify) | sentences for `schedule.*` |
| `app/lich-hoc/page.tsx`, `app/lich-hoc/schedule-editor.tsx`, `app/lich-hoc/extra-sheet.tsx` | the child's "Lịch học của con" page (3 tabs) |
| `app/today/calendar-card.tsx`, `lib/today/calendar.ts`, `lib/today/calendarServer.ts` (modify) | "Sửa lịch học" button + extra-class chips in the week view |
| `app/today/school-card.tsx`, `app/api/timetable/route.ts` (modify) | today's / tomorrow's extra classes, uniform via `uniformFor` |
| `app/parent/timetable/page.tsx`, `app/parent/timetable/recent-changes.tsx` (new) | extra classes (read) + "Con sửa gần đây" with Khôi phục |
| `tests/schedule.test.ts`, `tests/timetable.test.ts` (modify) | unit tests |
| `e2e/s-lich-hoc.spec.ts` | child edits → parent sees → restores |

---

### Task 1: SQL 0025 + RLS tests

**Files:**
- Create: `supabase/migrations/0025_child_schedule.sql`
- Modify: `supabase/tests/rls_test.sql` (new block right after the 0022 timetables block, before `reset role` of the next section)

**Interfaces:**
- Produces:
  - Table `public.extra_classes`: id, family_id, child_id, subject, sessions jsonb, place, bring, note, app_slot_id, active, updated_by, created_at, updated_at.
  - Table `public.subject_prefs`: child_id, family_id, subject_key, label, color, bring, updated_at; PK (child_id, subject_key).
  - Column `public.timetables.updated_by`.

- [ ] **Step 1: Write the RLS test block (fails: tables missing)**

```sql
reset role;
-- 0025 Lịch học con tự quản: parents + the child read; only the server (service_role) writes.
insert into public.extra_classes (family_id, child_id, subject, sessions, place) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'Văn', '[{"day":2,"start":"15:30","end":"17:00"}]', 'home'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c2', 'Tiếng Anh', '[{"day":4,"start":"20:30","end":"22:30"}]', 'online'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d1', 'Toán', '[]', 'center');
insert into public.subject_prefs (family_id, child_id, subject_key, label, color, bring) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'toan', 'Toán', '#3B6FB6', 'Thước, compa');
do $$
begin
  begin
    insert into public.extra_classes (family_id, child_id, subject, place) values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'Văn', 'moon');
    raise exception 'FAIL: bad place accepted';
  exception when check_violation then raise notice 'ok: place is one of home/center/online';
  end;
  begin
    insert into public.extra_classes (family_id, child_id, subject) values ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000c1', 'Văn');
    raise exception 'FAIL: extra class for a child of another family';
  exception when foreign_key_violation then raise notice 'ok: extra class child in the row family';
  end;
  begin
    insert into public.subject_prefs (family_id, child_id, subject_key, color) values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'van', 'red');
    raise exception 'FAIL: bad colour accepted';
  exception when check_violation then raise notice 'ok: colour is #RRGGBB or empty';
  end;
end $$;
select test_helpers.expect_count('extra_classes has RLS on', (select count(*) from pg_class where oid = 'public.extra_classes'::regclass and relrowsecurity), 1);
select test_helpers.expect_count('subject_prefs has RLS on', (select count(*) from pg_class where oid = 'public.subject_prefs'::regclass and relrowsecurity), 1);
select test_helpers.expect_count('anon has no extra_classes access', (select case when has_table_privilege('anon', 'public.extra_classes', 'SELECT') then 1 else 0 end), 0);
select test_helpers.expect_count('authenticated cannot insert extra_classes', (select case when has_table_privilege('authenticated', 'public.extra_classes', 'INSERT') then 1 else 0 end), 0);
select test_helpers.expect_count('authenticated cannot update subject_prefs', (select case when has_table_privilege('authenticated', 'public.subject_prefs', 'UPDATE') then 1 else 0 end), 0);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select test_helpers.expect_count('child1 sees only own extra classes', (select count(*) from public.extra_classes), 1);
select test_helpers.expect_count('child1 sees own subject prefs', (select count(*) from public.subject_prefs), 1);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select test_helpers.expect_count('parentA sees the family extra classes (2)', (select count(*) from public.extra_classes), 2);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select test_helpers.expect_count('parentB sees only family B (1)', (select count(*) from public.extra_classes), 1);
reset role;
```

(Ids are the fixtures of `rls_test.sql`: family A `…0a`, children `…c1`/`…c2`, parent A `…a1`; family B `…0b`, child `…d1`, parent B `…b1`.)

- [ ] **Step 2: Run it and see it fail**

Run: `TEST_DB_NAME=lh1 PGHOST=/tmp PGPORT=5433 PGUSER=postgres bash scripts/test-db.sh`
Expected: FAIL `relation "public.extra_classes" does not exist`.
If Postgres is down: `rm -f /tmp/pgdata/postmaster.pid /tmp/.s.PGSQL.5433.lock; /usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgdata -o '-p 5433 -k /tmp' -l /tmp/pg.log start`.

- [ ] **Step 3: Write the migration**

```sql
-- 0025 Lịch học con tự quản (parent decisions 21/11/2026): the child keeps their own timetable,
-- extra classes (học thêm / gia sư) and subject list. "Con tự sửa, áp dụng ngay; bố mẹ được báo và
-- khôi phục được bản trước." The child still has SELECT only: every write goes through the
-- server (/api/schedule/*, service_role after the session check) and logs audit_log with a
-- `before` snapshot that the parents can restore.
--
-- ADDITIVE and idempotent: two new tables, one nullable column. Nothing else changes.
--
-- extra_classes.sessions: [{ "day": 1..7 (Thứ 2..Chủ nhật), "start": "HH:MM", "end": "HH:MM" }]
-- (validated by the server, lib/schedule/rules.ts).

create table if not exists public.extra_classes (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families (id) on delete cascade,
  child_id     uuid not null references public.profiles (id) on delete cascade,
  subject      text not null,
  sessions     jsonb not null default '[]'::jsonb,
  place        text not null default 'home',
  bring        text not null default '',
  note         text not null default '',
  app_slot_id  uuid references public.app_slots (id) on delete set null,
  active       boolean not null default true,
  updated_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint extra_classes_subject_len check (char_length(subject) between 1 and 30),
  constraint extra_classes_sessions_array check (jsonb_typeof(sessions) = 'array'),
  constraint extra_classes_place check (place in ('home', 'center', 'online')),
  constraint extra_classes_bring_len check (char_length(bring) <= 120),
  constraint extra_classes_note_len check (char_length(note) <= 120)
);
create index if not exists extra_classes_child_idx on public.extra_classes (child_id) where active;

create table if not exists public.subject_prefs (
  child_id     uuid not null references public.profiles (id) on delete cascade,
  family_id    uuid not null references public.families (id) on delete cascade,
  subject_key  text not null,
  label        text not null default '',
  color        text not null default '',
  bring        text not null default '',
  updated_at   timestamptz not null default now(),
  primary key (child_id, subject_key),
  constraint subject_prefs_key_len check (char_length(subject_key) between 1 and 40),
  constraint subject_prefs_label_len check (char_length(label) <= 30),
  constraint subject_prefs_color check (color = '' or color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint subject_prefs_bring_len check (char_length(bring) <= 120)
);

alter table public.timetables add column if not exists updated_by uuid references public.profiles (id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'extra_classes_child_family_fk' and conrelid = 'public.extra_classes'::regclass) then
    alter table public.extra_classes add constraint extra_classes_child_family_fk
      foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'subject_prefs_child_family_fk' and conrelid = 'public.subject_prefs'::regclass) then
    alter table public.subject_prefs add constraint subject_prefs_child_family_fk
      foreign key (child_id, family_id) references public.profiles (id, family_id) on delete cascade;
  end if;
end $$;

alter table public.extra_classes enable row level security;
alter table public.subject_prefs enable row level security;

revoke all on public.extra_classes from public, anon, authenticated;
revoke all on public.subject_prefs from public, anon, authenticated;
grant select on public.extra_classes to authenticated;
grant select on public.subject_prefs to authenticated;
grant all on public.extra_classes to service_role;
grant all on public.subject_prefs to service_role;

drop policy if exists parent_select on public.extra_classes;
create policy parent_select on public.extra_classes for select to authenticated
  using (public.auth_role() = 'parent' and family_id = public.auth_family_id());
drop policy if exists child_select_own on public.extra_classes;
create policy child_select_own on public.extra_classes for select to authenticated
  using (public.auth_role() = 'child' and child_id = auth.uid());

drop policy if exists parent_select on public.subject_prefs;
create policy parent_select on public.subject_prefs for select to authenticated
  using (public.auth_role() = 'parent' and family_id = public.auth_family_id());
drop policy if exists child_select_own on public.subject_prefs;
create policy child_select_own on public.subject_prefs for select to authenticated
  using (public.auth_role() = 'child' and child_id = auth.uid());
```

- [ ] **Step 4: Run the DB test again**

Run: same as Step 2. Expected: all `ok:` notices, no `FAIL`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0025_child_schedule.sql supabase/tests/rls_test.sql
git commit -m "feat(schedule): SQL 0025 extra classes + subject prefs (child reads, server writes)"
```

---

### Task 2: Timetable rules — PE uniform, subject groups, `validateData`

**Files:**
- Modify: `lib/timetable/rules.ts`
- Test: `tests/timetable.test.ts` (existing file; add a `describe`)

**Interfaces:**
- Produces:
  - `export const PE_KEY = "pe"`
  - `export function uniformFor(v: TimetableData, weekday: number): string | null`
  - `export function validateData(raw: unknown): { ok: true; data: TimetableData } | { ok: false; error: string }`
  - `subjectKey("Thể dục") === subjectKey("GDTC") === "the duc"`, `subjectKey("NT(MT)") === "my thuat"`, `subjectKey("Nhạc") === "am nhac"`
  - `parseQuick` / `toQuick` understand the line `ĐỒNG PHỤC THỂ DỤC: …`
  - `dayPlan(...).uniform` now comes from `uniformFor`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { dayPlan, parseQuick, subjectKey, toQuick, uniformFor, validateData, type TimetableVersion } from "@/lib/timetable/rules";

const nguyen = (periods: { day: number; subject: string }[]): TimetableVersion => ({
  id: "v", childId: "c", validFrom: "2026-11-09", label: "9A13", note: "",
  periods: periods.map((p, i) => ({ day: p.day, session: "am", n: (i % 5) + 1, subject: p.subject })),
  times: {},
  uniform: { "1": "Áo đồng phục lớp", "2": "Áo trắng", "3": "Áo trắng", "4": "Áo trắng", "5": "Áo đồng phục lớp", "6": "Áo trắng", pe: "Đồng phục thể dục (áo xanh lá)" },
});

describe("uniform rule (21/11/2026)", () => {
  it("a day with Thể dục wears the PE uniform, else the weekday text", () => {
    const v = nguyen([{ day: 3, subject: "Thể dục" }, { day: 2, subject: "Hóa" }, { day: 6, subject: "Thể dục" }]);
    expect(uniformFor(v, 3)).toBe("Đồng phục thể dục (áo xanh lá)");
    expect(uniformFor(v, 2)).toBe("Áo trắng");
    expect(uniformFor(v, 6)).toBe("Đồng phục thể dục (áo xanh lá)");
    expect(uniformFor(v, 1)).toBe("Áo đồng phục lớp");
    expect(uniformFor(v, 7)).toBeNull();
  });
  it("PE wins even on a class-uniform day; GDTC counts as Thể dục", () => {
    expect(uniformFor(nguyen([{ day: 1, subject: "GDTC" }]), 1)).toBe("Đồng phục thể dục (áo xanh lá)");
  });
  it("without a pe key the weekday text stays (An)", () => {
    const v = { ...nguyen([{ day: 1, subject: "GDTC" }]), uniform: { "1": "Áo polo đỏ, quần thể thao" } };
    expect(uniformFor(v, 1)).toBe("Áo polo đỏ, quần thể thao");
  });
  it("dayPlan uses the rule", () => {
    expect(dayPlan([nguyen([{ day: 3, subject: "Thể dục" }])], "2026-11-25")?.uniform).toBe("Đồng phục thể dục (áo xanh lá)");
  });
  it("quick text round-trips the PE line", () => {
    const r = parseQuick("S1 07:30-08:15 | Toán | | Thể dục | | |\nĐỒNG PHỤC THỂ DỤC: Áo xanh lá");
    expect(r.ok && r.data.uniform.pe).toBe("Áo xanh lá");
    expect(r.ok && toQuick(r.data)).toContain("ĐỒNG PHỤC THỂ DỤC: Áo xanh lá");
  });
});

describe("subject groups", () => {
  it("folds the school names together", () => {
    expect(subjectKey("GDTC")).toBe("the duc");
    expect(subjectKey("Thể dục")).toBe("the duc");
    expect(subjectKey("NT(MT)")).toBe("my thuat");
    expect(subjectKey("Mỹ thuật")).toBe("my thuat");
    expect(subjectKey("NT(AN)")).toBe("am nhac");
    expect(subjectKey("Nhạc")).toBe("am nhac");
  });
});

describe("validateData (the child's editor sends JSON)", () => {
  const ok = { label: "9A13", note: "", periods: [{ day: 1, session: "am", n: 1, subject: "Toán" }], times: { am: { "1": "07:30-08:15" } }, uniform: { "1": "Áo lớp", pe: "Áo xanh" } };
  it("accepts a clean version", () => expect(validateData(ok)).toEqual({ ok: true, data: ok }));
  it("rejects a duplicate period", () => {
    const r = validateData({ ...ok, periods: [...ok.periods, { day: 1, session: "am", n: 1, subject: "Văn" }] });
    expect(r.ok).toBe(false);
  });
  it("rejects a bad time, a long subject, an unknown uniform key", () => {
    expect(validateData({ ...ok, times: { am: { "1": "7h" } } }).ok).toBe(false);
    expect(validateData({ ...ok, periods: [{ day: 1, session: "am", n: 1, subject: "x".repeat(31) }] }).ok).toBe(false);
    expect(validateData({ ...ok, uniform: { "9": "x" } }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run tests/timetable.test.ts`
Expected: FAIL (`uniformFor` / `validateData` not exported; `subjectKey("GDTC")` is `"gdtc"`).

- [ ] **Step 3: Implement**

In `lib/timetable/rules.ts`:

```ts
export const PE_KEY = "pe";

// GROUPS gains (after ["cong nghe", "cn"]):
//   ["the duc", "gdtc", "giao duc the chat"],
//   ["my thuat", "nt(mt)", "mt"],
//   ["am nhac", "nhac", "nt(an)"],

/**
 * The day's uniform (21/11/2026): a day with a Thể dục lesson wears `uniform.pe` when set
 * (Nguyên: áo xanh lá, wins over "T2/T6 áo lớp"); otherwise that weekday's text.
 */
export function uniformFor(v: Pick<TimetableData, "periods" | "uniform">, weekday: number): string | null {
  if (weekday < 1 || weekday > 6) return null;
  const pe = v.uniform[PE_KEY];
  if (pe && v.periods.some((p) => p.day === weekday && subjectKey(p.subject) === "the duc")) return pe;
  return v.uniform[String(weekday)] ?? null;
}

/** The child's editor sends the version as JSON: same limits as the quick text. */
export function validateData(raw: unknown): { ok: true; data: TimetableData } | { ok: false; error: string } {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!o || !Array.isArray(o.periods)) return { ok: false, error: "Thời khóa biểu không hợp lệ." };
  const seen = new Set<string>();
  const periods: Period[] = [];
  for (const p of o.periods as Record<string, unknown>[]) {
    const day = p?.day, n = p?.n, session = p?.session, subject = typeof p?.subject === "string" ? p.subject.trim() : "";
    if (typeof day !== "number" || day < 1 || day > 6 || typeof n !== "number" || n < 1 || n > MAX_PERIOD || (session !== "am" && session !== "pm"))
      return { ok: false, error: "Có tiết sai thứ hoặc số tiết." };
    if (!subject || subject.length > SUBJECT_MAX) return { ok: false, error: "Tên môn trống hoặc dài quá." };
    const k = `${day}${session}${n}`;
    if (seen.has(k)) return { ok: false, error: "Một tiết bị nhập hai lần." };
    seen.add(k);
    periods.push({ day, session, n, subject });
  }
  const times: TimetableData["times"] = {};
  const t = o.times && typeof o.times === "object" ? (o.times as Record<string, unknown>) : {};
  for (const s of ["am", "pm"] as const) {
    const m = t[s] && typeof t[s] === "object" ? (t[s] as Record<string, unknown>) : {};
    for (const [n, v] of Object.entries(m)) {
      const norm = typeof v === "string" ? normTime(v) : null;
      if (!/^[1-6]$/.test(n) || !norm) return { ok: false, error: "Giờ tiết chưa đúng (vd 07:30-08:15)." };
      times[s] = { ...(times[s] ?? {}), [n]: norm };
    }
  }
  const uniform: Record<string, string> = {};
  const u = o.uniform && typeof o.uniform === "object" ? (o.uniform as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(u)) {
    if (!/^[1-6]$/.test(k) && k !== PE_KEY) return { ok: false, error: "Đồng phục sai thứ." };
    if (typeof v !== "string" || v.length > 160) return { ok: false, error: "Đồng phục dài quá." };
    if (v.trim()) uniform[k] = v.trim();
  }
  const label = typeof o.label === "string" ? o.label.trim().slice(0, 40) : "";
  const note = typeof o.note === "string" ? o.note.trim().slice(0, 200) : "";
  return { ok: true, data: sortPeriods({ label, note, periods, times, uniform }) };
}
```

- `parseQuick`: before the `ĐỒNG PHỤC T…` match, add
  `m = /^ĐỒNG PHỤC\s*THỂ DỤC\s*:\s*(.*)$/iu.exec(line); if (m) { const t = m[1]!.trim().slice(0, 160); if (t) data.uniform[PE_KEY] = t; return; }`
- `toQuick`: after the weekday uniform loop, add `if (d.uniform[PE_KEY]) lines.push(\`ĐỒNG PHỤC THỂ DỤC: ${d.uniform[PE_KEY]}\`);`
- `dayPlan`: `uniform: uniformFor(v, weekday),`
- `sortPeriods` must keep the exact input order for a sorted list (the `toEqual` test sends sorted periods).

- [ ] **Step 4: Run them and see them pass**

Run: `npx vitest run tests/timetable.test.ts`. Expected: PASS. Then `npx vitest run`: all green. If an older test pinned `subjectKey("GDTC")`, update it to `"the duc"`.

- [ ] **Step 5: Commit**

```bash
git add lib/timetable/rules.ts tests/timetable.test.ts
git commit -m "feat(timetable): PE uniform rule, PE/art/music subject groups, JSON validation"
```

---

### Task 3: Extra-class rules (pure)

**Files:**
- Create: `lib/schedule/rules.ts`
- Test: `tests/schedule.test.ts`

**Interfaces:**
- Consumes: `TimetableVersion`, `Period`, `subjectKey`, `normTime` from Task 2; `isoWeekday`, `addDays` from `@/lib/time`.
- Produces (exact):

```ts
export type Place = "home" | "center" | "online";
export const PLACES: readonly Place[];
export const PLACE_LABEL: Record<Place, string>; // home "Ở nhà", center "Trung tâm", online "Online"
export interface ExtraSession { day: number; start: string; end: string }
export interface ExtraClass { id: string; childId: string; subject: string; sessions: ExtraSession[]; place: Place; bring: string; note: string; appSlotId: string | null; active: boolean }
export interface Busy { day: number; start: string; end: string; label: string; kind: "school" | "extra"; extraId?: string }
export interface SubjectPref { key: string; label: string; color: string; bring: string }
export interface SubjectRow { key: string; label: string; perWeek: number; color: string; bring: string; extraDays: number[] }
export const MAX_SESSIONS = 7;
export const SUBJECT_COLORS: readonly string[]; // 8 swatches
export function dayShort(day: number): string;                     // 1 "T2" … 6 "T7", 7 "CN"
export function normClock(raw: string): string | null;             // "8h30" | "08:30" → "08:30"
export function cleanSessions(raw: unknown): ExtraSession[] | string; // string = Vietnamese error
export function sessionsText(s: readonly ExtraSession[]): string;  // "T3 15:30–17:00, T5 13:00–14:30"
export function schoolBusy(v: TimetableVersion | null): Busy[];
export function extraBusy(extras: readonly ExtraClass[], skipId?: string): Busy[];
export function conflicts(sessions: readonly ExtraSession[], busy: readonly Busy[]): { session: ExtraSession; with: Busy }[];
export function extrasOn(extras: readonly ExtraClass[], date: string): { extra: ExtraClass; session: ExtraSession }[];
export function diffPeriods(before: readonly Period[], after: readonly Period[]): string[];
export function defaultBring(key: string): string;
export function subjectRows(v: TimetableVersion | null, extras: readonly ExtraClass[], prefs: readonly SubjectPref[]): SubjectRow[];
export function fromExtraRow(r: { id: string; child_id: string; subject: string; sessions: unknown; place: string; bring: string | null; note: string | null; app_slot_id: string | null; active: boolean }): ExtraClass;
```

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { cleanSessions, conflicts, dayShort, defaultBring, diffPeriods, extraBusy, extrasOn, normClock, schoolBusy, sessionsText, subjectRows, type ExtraClass } from "@/lib/schedule/rules";
import type { TimetableVersion } from "@/lib/timetable/rules";

// An's 6A6 afternoon: T2/T3 C2–C3 13:50–15:25 (data from 21/11/2026).
const an: TimetableVersion = {
  id: "v", childId: "an", validFrom: "2026-11-09", label: "6A6", note: "",
  periods: [
    { day: 1, session: "am", n: 1, subject: "CHAOCO" }, { day: 1, session: "pm", n: 2, subject: "LS&ĐL(ĐL)" }, { day: 1, session: "pm", n: 3, subject: "ANH" },
    { day: 2, session: "am", n: 5, subject: "Toán" }, { day: 2, session: "pm", n: 2, subject: "KHTN(H)" }, { day: 2, session: "pm", n: 3, subject: "KHTN(S)" },
    { day: 4, session: "am", n: 1, subject: "Văn" },
  ],
  times: { am: { "1": "07:30-08:15", "5": "11:00-11:45" }, pm: { "2": "13:50-14:35", "3": "14:40-15:25" } },
  uniform: {},
};
const x = (id: string, subject: string, sessions: { day: number; start: string; end: string }[]): ExtraClass =>
  ({ id, childId: "an", subject, sessions, place: "home", bring: "", note: "", appSlotId: null, active: true });

describe("extra-class sessions", () => {
  it("normalises clocks and orders sessions", () => {
    expect(normClock("8h30")).toBe("08:30");
    expect(normClock("15:30")).toBe("15:30");
    expect(normClock("25:00")).toBeNull();
    expect(cleanSessions([{ day: 4, start: "13:00", end: "14:30" }, { day: 2, start: "15h30", end: "17h" }])).toEqual([
      { day: 2, start: "15:30", end: "17:00" }, { day: 4, start: "13:00", end: "14:30" },
    ]);
  });
  it("rejects end before start, a bad day, too many sessions", () => {
    expect(typeof cleanSessions([{ day: 2, start: "17:00", end: "15:30" }])).toBe("string");
    expect(typeof cleanSessions([{ day: 8, start: "15:00", end: "16:00" }])).toBe("string");
    expect(typeof cleanSessions(Array.from({ length: 8 }, (_, i) => ({ day: 1, start: `0${i}:00`, end: `0${i}:30` })))).toBe("string");
  });
  it("writes them short", () => {
    expect(dayShort(7)).toBe("CN");
    expect(sessionsText([{ day: 2, start: "15:30", end: "17:00" }, { day: 4, start: "13:00", end: "14:30" }])).toBe("T3 15:30–17:00, T5 13:00–14:30");
  });
});

describe("busy + conflicts", () => {
  it("school afternoon T3 is 13:50–15:25; Văn 15:30 does not clash, 13:30 does", () => {
    const busy = schoolBusy(an);
    expect(busy).toContainEqual({ day: 2, start: "13:50", end: "15:25", label: "Học chiều ở trường", kind: "school" });
    expect(conflicts([{ day: 2, start: "15:30", end: "17:00" }], busy)).toEqual([]);
    expect(conflicts([{ day: 2, start: "13:30", end: "15:00" }], busy)).toHaveLength(1);
  });
  it("other extra classes count, the one being edited does not", () => {
    const anh = x("e1", "Tiếng Anh", [{ day: 1, start: "15:30", end: "17:30" }]);
    expect(conflicts([{ day: 1, start: "17:00", end: "18:00" }], extraBusy([anh]))).toHaveLength(1);
    expect(conflicts([{ day: 1, start: "17:00", end: "18:00" }], extraBusy([anh], "e1"))).toEqual([]);
  });
  it("touching ends do not clash", () => {
    expect(conflicts([{ day: 2, start: "15:25", end: "16:00" }], schoolBusy(an))).toEqual([]);
  });
});

describe("extrasOn", () => {
  it("lists the day's classes by start time (Sunday = 7)", () => {
    const gs = x("g", "Gia sư Tiếng Anh", [{ day: 7, start: "20:30", end: "22:30" }, { day: 4, start: "20:30", end: "22:30" }]);
    const van = x("v", "Văn", [{ day: 4, start: "14:30", end: "16:30" }]);
    expect(extrasOn([gs, van], "2026-11-26").map((e) => e.extra.id)).toEqual(["v", "g"]); // Thursday
    expect(extrasOn([gs], "2026-11-29").map((e) => e.session.start)).toEqual(["20:30"]); // Sunday
    expect(extrasOn([{ ...van, active: false }], "2026-11-26")).toEqual([]);
  });
});

describe("diffPeriods", () => {
  it("names each changed period", () => {
    const before = [{ day: 3, session: "am" as const, n: 3, subject: "Thể dục" }];
    expect(diffPeriods(before, [{ day: 3, session: "am", n: 3, subject: "Toán" }])).toEqual(["T4 tiết 3: Thể dục → Toán"]);
    expect(diffPeriods(before, [])).toEqual(["T4 tiết 3: bỏ Thể dục"]);
    expect(diffPeriods([], before)).toEqual(["T4 tiết 3: thêm Thể dục"]);
    expect(diffPeriods([{ day: 1, session: "pm", n: 2, subject: "Anh" }], [{ day: 1, session: "pm", n: 2, subject: "Văn" }])).toEqual(["T2 chiều tiết 2: Anh → Văn"]);
  });
});

describe("subjectRows", () => {
  it("counts lessons per week, merges groups, adds extra-class days and prefs", () => {
    const rows = subjectRows(an, [x("v", "Văn", [{ day: 2, start: "15:30", end: "17:00" }, { day: 4, start: "13:00", end: "14:30" }])], [{ key: "toan", label: "", color: "#3B6FB6", bring: "Thước, compa" }]);
    const van = rows.find((r) => r.key === "van");
    expect(van).toMatchObject({ label: "Văn", perWeek: 1, extraDays: [2, 4] });
    expect(rows.find((r) => r.key === "toan")).toMatchObject({ color: "#3B6FB6", bring: "Thước, compa" });
    expect(rows.find((r) => r.key === "khtn")?.perWeek).toBe(2);
    expect(rows.some((r) => r.key === "chaoco" || r.label === "CHAOCO")).toBe(true);
  });
  it("suggests a bring list by subject", () => {
    expect(defaultBring("the duc")).toBe("Giày thể thao, nước");
    expect(defaultBring("my thuat")).toBe("Bút màu, giấy vẽ");
    expect(defaultBring("van")).toBe("");
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run tests/schedule.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/schedule/rules.ts`**

```ts
/**
 * Lịch học con tự quản (parent decisions 21/11/2026): extra classes (học thêm / gia sư) and the
 * subject list, PURE. Display only: nothing here changes what locks or opens the laptop.
 * Weekdays: 1 = Thứ 2 … 6 = Thứ 7, 7 = Chủ nhật (isoWeekday).
 */
import { isoWeekday } from "@/lib/time";
import { subjectKey, type Period, type TimetableVersion } from "@/lib/timetable/rules";

export type Place = "home" | "center" | "online";
export const PLACES: readonly Place[] = ["home", "center", "online"];
export const PLACE_LABEL: Record<Place, string> = { home: "Ở nhà", center: "Trung tâm", online: "Online" };
export interface ExtraSession { day: number; start: string; end: string }
export interface ExtraClass { id: string; childId: string; subject: string; sessions: ExtraSession[]; place: Place; bring: string; note: string; appSlotId: string | null; active: boolean }
export interface Busy { day: number; start: string; end: string; label: string; kind: "school" | "extra"; extraId?: string }
export interface SubjectPref { key: string; label: string; color: string; bring: string }
export interface SubjectRow { key: string; label: string; perWeek: number; color: string; bring: string; extraDays: number[] }

export const MAX_SESSIONS = 7;
export const SUBJECT_COLORS = ["#3B6FB6", "#B4432E", "#2B7A6F", "#7A5AA8", "#A8650F", "#4C8A3A", "#8A5A3B", "#3C8A8F"] as const;
const DAY_SHORT = ["", "T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export const dayShort = (day: number): string => DAY_SHORT[day] ?? "";
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export function normClock(raw: string): string | null {
  const m = /^(\d{1,2})(?:[:hH](\d{2})?)?$/.exec(raw.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2] ?? "0");
  return h <= 23 && mm <= 59 ? `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}` : null;
}

export function cleanSessions(raw: unknown): ExtraSession[] | string {
  if (!Array.isArray(raw) || raw.length === 0) return "Thêm ít nhất 1 buổi.";
  if (raw.length > MAX_SESSIONS) return `Tối đa ${MAX_SESSIONS} buổi một tuần.`;
  const out: ExtraSession[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    const day = r?.day;
    if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > 7) return "Có buổi sai thứ.";
    const start = typeof r.start === "string" ? normClock(r.start) : null;
    const end = typeof r.end === "string" ? normClock(r.end) : null;
    if (!start || !end) return "Giờ chưa đúng (vd 15:30).";
    if (toMin(end) <= toMin(start)) return "Giờ kết thúc phải sau giờ bắt đầu.";
    out.push({ day, start, end });
  }
  return out.sort((a, b) => a.day - b.day || toMin(a.start) - toMin(b.start));
}

export const sessionsText = (s: readonly ExtraSession[]): string => s.map((x) => `${dayShort(x.day)} ${x.start}–${x.end}`).join(", ");

/** School hours per weekday and session, from the period times (no times = unknown = not busy). */
export function schoolBusy(v: TimetableVersion | null): Busy[] {
  if (!v) return [];
  const out: Busy[] = [];
  for (let day = 1; day <= 6; day++) {
    for (const session of ["am", "pm"] as const) {
      const spans = v.periods
        .filter((p) => p.day === day && p.session === session)
        .map((p) => v.times[session]?.[String(p.n)])
        .filter((t): t is string => !!t)
        .map((t) => t.split("-") as [string, string]);
      if (spans.length === 0) continue;
      const start = spans.map((s) => s[0]).sort()[0]!;
      const end = spans.map((s) => s[1]).sort().at(-1)!;
      out.push({ day, start, end, label: session === "am" ? "Học sáng ở trường" : "Học chiều ở trường", kind: "school" });
    }
  }
  return out;
}

export function extraBusy(extras: readonly ExtraClass[], skipId?: string): Busy[] {
  return extras
    .filter((e) => e.active && e.id !== skipId)
    .flatMap((e) => e.sessions.map((s) => ({ day: s.day, start: s.start, end: s.end, label: `Học thêm ${e.subject}`, kind: "extra" as const, extraId: e.id })));
}

export function conflicts(sessions: readonly ExtraSession[], busy: readonly Busy[]): { session: ExtraSession; with: Busy }[] {
  const out: { session: ExtraSession; with: Busy }[] = [];
  for (const s of sessions)
    for (const b of busy)
      if (b.day === s.day && toMin(s.start) < toMin(b.end) && toMin(b.start) < toMin(s.end)) out.push({ session: s, with: b });
  return out;
}

export function extrasOn(extras: readonly ExtraClass[], date: string): { extra: ExtraClass; session: ExtraSession }[] {
  const wd = isoWeekday(date);
  return extras
    .filter((e) => e.active)
    .flatMap((e) => e.sessions.filter((s) => s.day === wd).map((session) => ({ extra: e, session })))
    .sort((a, b) => toMin(a.session.start) - toMin(b.session.start));
}

const slot = (p: Pick<Period, "day" | "session" | "n">) => `${dayShort(p.day)}${p.session === "pm" ? " chiều" : ""} tiết ${p.n}`;

export function diffPeriods(before: readonly Period[], after: readonly Period[]): string[] {
  const key = (p: Period) => `${p.day}|${p.session}|${p.n}`;
  const a = new Map(before.map((p) => [key(p), p]));
  const b = new Map(after.map((p) => [key(p), p]));
  const keys = [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => {
    const [dx, sx, nx] = x.split("|");
    const [dy, sy, ny] = y.split("|");
    return Number(dx) - Number(dy) || (sx === sy ? 0 : sx === "am" ? -1 : 1) || Number(nx) - Number(ny);
  });
  const out: string[] = [];
  for (const k of keys) {
    const p = a.get(k);
    const q = b.get(k);
    if (p && q && p.subject !== q.subject) out.push(`${slot(p)}: ${p.subject} → ${q.subject}`);
    else if (p && !q) out.push(`${slot(p)}: bỏ ${p.subject}`);
    else if (!p && q) out.push(`${slot(q)}: thêm ${q.subject}`);
  }
  return out;
}

const BRING: Record<string, string> = {
  "the duc": "Giày thể thao, nước",
  "my thuat": "Bút màu, giấy vẽ",
  toan: "Thước, compa",
  chaoco: "Khăn quàng đỏ",
};
export const defaultBring = (key: string): string => BRING[key] ?? "";

/** The child's subjects: from the timetable in force, plus extra-class subjects; prefs override. */
export function subjectRows(v: TimetableVersion | null, extras: readonly ExtraClass[], prefs: readonly SubjectPref[]): SubjectRow[] {
  const rows = new Map<string, SubjectRow>();
  const add = (name: string) => {
    const key = subjectKey(name);
    if (!rows.has(key)) rows.set(key, { key, label: name, perWeek: 0, color: "", bring: defaultBring(key), extraDays: [] });
    return rows.get(key)!;
  };
  for (const p of v?.periods ?? []) add(p.subject).perWeek += 1;
  for (const e of extras.filter((x) => x.active)) {
    const r = add(e.subject);
    for (const s of e.sessions) if (!r.extraDays.includes(s.day)) r.extraDays.push(s.day);
    r.extraDays.sort((a, b) => a - b);
  }
  const ordered = [...rows.values()];
  ordered.forEach((r, i) => {
    const pref = prefs.find((p) => p.key === r.key);
    r.color = pref?.color || SUBJECT_COLORS[i % SUBJECT_COLORS.length]!;
    if (pref?.label) r.label = pref.label;
    if (pref && pref.bring !== undefined && pref.bring !== "") r.bring = pref.bring;
  });
  return ordered.sort((a, b) => b.perWeek - a.perWeek || a.label.localeCompare(b.label, "vi"));
}

export function fromExtraRow(r: { id: string; child_id: string; subject: string; sessions: unknown; place: string; bring: string | null; note: string | null; app_slot_id: string | null; active: boolean }): ExtraClass {
  const s = cleanSessions(r.sessions);
  return {
    id: r.id, childId: r.child_id, subject: r.subject, sessions: typeof s === "string" ? [] : s,
    place: (PLACES as readonly string[]).includes(r.place) ? (r.place as Place) : "home",
    bring: r.bring ?? "", note: r.note ?? "", appSlotId: r.app_slot_id, active: r.active,
  };
}
```

`subjectKey("CHAOCO")` folds to `"chaoco"`, which matches the test (`chaoco` row exists).

- [ ] **Step 4: Run them and see them pass**

Run: `npx vitest run tests/schedule.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/schedule/rules.ts tests/schedule.test.ts
git commit -m "feat(schedule): pure rules for extra classes, clashes, period diff, subject rows"
```

---

### Task 4: Load + write helpers, child GET route

**Files:**
- Create: `lib/schedule/load.ts`, `lib/schedule/write.ts`, `app/api/schedule/route.ts`
- Test: `tests/scheduleWrite.test.ts` (pure parts of `write.ts`: `extraSnapshot`, `timetableSnapshot`)

**Interfaces:**
- Consumes: `fromRow` (timetable), `fromExtraRow`, `TimetableData`, `ExtraClass`.
- Produces:

```ts
// load.ts (server-only)
export interface ScheduleData { versions: TimetableVersion[]; extras: ExtraClass[]; prefs: SubjectPref[] }
export async function loadSchedule(db: SupabaseClient, childIds: readonly string[]): Promise<ScheduleData>;
// write.ts
export type ScheduleAction = "schedule.timetable" | "schedule.extra.save" | "schedule.extra.off" | "schedule.restore";
export function timetableSnapshot(d: TimetableData & { validFrom: string }): Record<string, unknown>;
export function extraSnapshot(e: Omit<ExtraClass, "id" | "childId">): Record<string, unknown>;
export async function scheduleAudit(familyId: string, actorId: string, action: ScheduleAction, payload: Record<string, unknown>): Promise<void>; // service_role insert, never throws
// GET /api/schedule → { today, versions, extras, prefs, slots: { id, label }[] }
```

- [ ] **Step 1: Failing test for the snapshots**

```ts
import { describe, expect, it } from "vitest";
import { extraSnapshot, timetableSnapshot } from "@/lib/schedule/write";

describe("audit snapshots (what Khôi phục puts back)", () => {
  it("keeps exactly the restorable fields", () => {
    expect(extraSnapshot({ subject: "Văn", sessions: [{ day: 2, start: "15:30", end: "17:00" }], place: "home", bring: "Vở", note: "", appSlotId: null, active: true }))
      .toEqual({ subject: "Văn", sessions: [{ day: 2, start: "15:30", end: "17:00" }], place: "home", bring: "Vở", note: "", app_slot_id: null, active: true });
    expect(timetableSnapshot({ validFrom: "2026-11-09", label: "9A13", note: "", periods: [], times: {}, uniform: { pe: "Áo xanh" } }))
      .toEqual({ valid_from: "2026-11-09", label: "9A13", note: "", periods: [], times: {}, uniform: { pe: "Áo xanh" } });
  });
});
```

- [ ] **Step 2: Run and see it fail**: `npx vitest run tests/scheduleWrite.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`lib/schedule/write.ts` (the top of the file must not import `server-only`, because the test imports the snapshots; only the audit function uses the admin client):

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import type { TimetableData } from "@/lib/timetable/rules";
import type { ExtraClass } from "./rules";

export type ScheduleAction = "schedule.timetable" | "schedule.extra.save" | "schedule.extra.off" | "schedule.restore";

export const timetableSnapshot = (d: TimetableData & { validFrom: string }) =>
  ({ valid_from: d.validFrom, label: d.label, note: d.note, periods: d.periods, times: d.times, uniform: d.uniform });

export const extraSnapshot = (e: Omit<ExtraClass, "id" | "childId">) =>
  ({ subject: e.subject, sessions: e.sessions, place: e.place, bring: e.bring, note: e.note, app_slot_id: e.appSlotId, active: e.active });

/** One audit_log row per change (server-written only). Never breaks the child's save. */
export async function scheduleAudit(familyId: string, actorId: string, action: ScheduleAction, payload: Record<string, unknown>) {
  try {
    const { error } = await createAdminClient().from("audit_log").insert({ family_id: familyId, actor_id: actorId, action, payload });
    if (error) console.error("audit_log insert failed", action, error.message);
  } catch (e) {
    console.error("audit_log insert failed", action, e instanceof Error ? e.message : e);
  }
}
```

If Vitest cannot import `@/lib/supabase/admin` (it may read env at import), move `scheduleAudit` to `lib/schedule/audit.ts` and keep `write.ts` pure. Check `lib/supabase/admin.ts` first.

`lib/schedule/load.ts`:

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTimetables } from "@/lib/timetable/load";
import type { TimetableVersion } from "@/lib/timetable/rules";
import { fromExtraRow, type ExtraClass, type SubjectPref } from "./rules";

export interface ScheduleData { versions: TimetableVersion[]; extras: ExtraClass[]; prefs: SubjectPref[] }

/** With the CALLER's session (RLS). A read error gives empty lists, never a broken page. */
export async function loadSchedule(db: SupabaseClient, childIds: readonly string[]): Promise<ScheduleData> {
  if (childIds.length === 0) return { versions: [], extras: [], prefs: [] };
  const [versions, ex, pr] = await Promise.all([
    loadTimetables(db, childIds),
    db.from("extra_classes").select("id, child_id, subject, sessions, place, bring, note, app_slot_id, active").in("child_id", [...childIds]).eq("active", true).order("created_at"),
    db.from("subject_prefs").select("child_id, subject_key, label, color, bring").in("child_id", [...childIds]),
  ]);
  if (ex.error) console.error("extra_classes read failed", ex.error.message);
  if (pr.error) console.error("subject_prefs read failed", pr.error.message);
  return {
    versions,
    extras: (ex.data ?? []).map((r) => fromExtraRow(r as Parameters<typeof fromExtraRow>[0])),
    prefs: (pr.data ?? []).map((r) => ({ key: r.subject_key as string, label: (r.label as string) ?? "", color: (r.color as string) ?? "", bring: (r.bring as string) ?? "" })),
  };
}
```

(`prefs` carries no child id. When several children are loaded (the parent page), group by `child_id` before mapping: add `childId` to `SubjectPref` only if the parent page needs it; Lát 1's parent page shows extras only.)

`app/api/schedule/route.ts`:

```ts
import { NextResponse } from "next/server";
import { localDate } from "@/lib/time";
import { loadSchedule } from "@/lib/schedule/load";
import { requireChild, serverError } from "@/lib/today/service";

export const dynamic = "force-dynamic";

/** GET: the child's own schedule (timetable versions, extra classes, subject prefs, app slots). */
export async function GET() {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  try {
    const [data, slots] = await Promise.all([
      loadSchedule(ctx.db, [ctx.childId]),
      ctx.db.from("app_slots").select("id, label, kind").eq("active", true).neq("kind", "placeholder"),
    ]);
    return NextResponse.json(
      { today: localDate(new Date()), ...data, slots: (slots.data ?? []).map((s) => ({ id: s.id as string, label: s.label as string })) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return serverError("schedule", e);
  }
}
```

- [ ] **Step 4: Run** `npx vitest run tests/scheduleWrite.test.ts && npm run typecheck`. Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/schedule/load.ts lib/schedule/write.ts app/api/schedule/route.ts tests/scheduleWrite.test.ts
git commit -m "feat(schedule): load helpers, audit snapshots, child GET /api/schedule"
```

---

### Task 5: Child write routes (timetable, extra class, subject)

**Files:**
- Create: `app/api/schedule/timetable/route.ts`, `app/api/schedule/extra/route.ts`, `app/api/schedule/subject/route.ts`
- Test: e2e covers these (Task 9). Add one Vitest file `tests/scheduleRoutes.test.ts` for the pure guard `childValidFromOk`.

**Interfaces:**
- Consumes: `validateData`, `versionOn`, `cleanSessions`, `conflicts`, `schoolBusy`, `extraBusy`, `diffPeriods`, `sessionsText`, `timetableSnapshot`, `extraSnapshot`, `scheduleAudit`.
- Produces:
  - `export function childValidFromOk(validFrom: string, current: string | null, today: string): string | null` in `lib/schedule/rules.ts` (null = ok, else a Vietnamese error). It accepts dates from `current ?? today` up to `today + 60 days`.
  - POST `/api/schedule/timetable` `{ validFrom, data: TimetableData }` → `{ ok: true, id, changes: string[] }`
  - POST `/api/schedule/extra` `{ id?, subject, sessions, place, bring, note, appSlotId }` → `{ ok: true, id, conflicts: { session, with }[] }`
  - DELETE `/api/schedule/extra?id=` → `{ ok: true }` (sets `active=false`)
  - POST `/api/schedule/subject` `{ key, label, color, bring }` → `{ ok: true }`

- [ ] **Step 1: Failing test for `childValidFromOk`**

```ts
import { describe, expect, it } from "vitest";
import { childValidFromOk } from "@/lib/schedule/rules";

describe("childValidFromOk", () => {
  it("edits the version in force or starts a new one up to 60 days ahead, never rewrites older history", () => {
    expect(childValidFromOk("2026-11-09", "2026-11-09", "2026-11-21")).toBeNull();
    expect(childValidFromOk("2026-12-01", "2026-11-09", "2026-11-21")).toBeNull();
    expect(childValidFromOk("2026-11-01", "2026-11-09", "2026-11-21")).toMatch(/trước/);
    expect(childValidFromOk("2027-02-01", "2026-11-09", "2026-11-21")).toMatch(/60 ngày/);
    expect(childValidFromOk("2026-11-21", null, "2026-11-21")).toBeNull();
  });
});
```

- [ ] **Step 2: Run, see FAIL** (`childValidFromOk` missing).

- [ ] **Step 3: Implement**

In `lib/schedule/rules.ts`:

```ts
import { addDays } from "@/lib/time";
/** The child may edit the version in force or start a new one, from that day up to 60 days ahead. */
export function childValidFromOk(validFrom: string, current: string | null, today: string): string | null {
  const floor = current ?? today;
  if (validFrom < floor) return "Không sửa được bản trước bản đang dùng.";
  if (validFrom > addDays(today, 60)) return "Chỉ đặt ngày áp dụng trong 60 ngày tới.";
  return null;
}
```

`app/api/schedule/timetable/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDate } from "@/lib/time";
import { loadTimetables } from "@/lib/timetable/load";
import { validateData, versionOn } from "@/lib/timetable/rules";
import { childValidFromOk, diffPeriods } from "@/lib/schedule/rules";
import { scheduleAudit, timetableSnapshot } from "@/lib/schedule/write";
import { jsonError, requireChild, serverError } from "@/lib/today/service";

const bodySchema = z.object({ validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), data: z.unknown() });

/**
 * The child saves their timetable (parent decision 21/11/2026: "con tự sửa, áp dụng ngay"). Server
 * checks the shape and the date, writes with service_role, and logs the BEFORE for Khôi phục.
 */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Ngày áp dụng chưa đúng.", 400);
  const v = validateData(parsed.data.data);
  if (!v.ok) return jsonError(v.error, 400);
  try {
    const today = localDate(new Date());
    const versions = await loadTimetables(ctx.db, [ctx.childId]);
    const current = versionOn(versions, today);
    const bad = childValidFromOk(parsed.data.validFrom, current?.validFrom ?? null, today);
    if (bad) return jsonError(bad, 400);
    const same = versions.find((x) => x.validFrom === parsed.data.validFrom) ?? null;
    const before = same ?? versionOn(versions, parsed.data.validFrom);
    const row = { family_id: ctx.familyId, child_id: ctx.childId, valid_from: parsed.data.validFrom, ...v.data, updated_by: ctx.childId, updated_at: new Date().toISOString() };
    const { data, error } = await createAdminClient().from("timetables").upsert(row, { onConflict: "child_id,valid_from" }).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "no row");
    const changes = diffPeriods(before?.periods ?? [], v.data.periods);
    await scheduleAudit(ctx.familyId, ctx.childId, "schedule.timetable", {
      child_id: ctx.childId, id: data.id, valid_from: parsed.data.validFrom, changes: changes.slice(0, 12),
      uniform_changed: JSON.stringify(before?.uniform ?? {}) !== JSON.stringify(v.data.uniform),
      before: same ? timetableSnapshot(same) : null, // null = this version is new: Khôi phục deletes it
    });
    return NextResponse.json({ ok: true, id: data.id, changes });
  } catch (e) {
    return serverError("schedule.timetable", e);
  }
}
```

`app/api/schedule/extra/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDate } from "@/lib/time";
import { loadSchedule } from "@/lib/schedule/load";
import { cleanSessions, conflicts, extraBusy, PLACES, schoolBusy, sessionsText } from "@/lib/schedule/rules";
import { extraSnapshot, scheduleAudit } from "@/lib/schedule/write";
import { versionOn } from "@/lib/timetable/rules";
import { jsonError, requireChild, serverError } from "@/lib/today/service";

const bodySchema = z.object({
  id: z.string().uuid().optional(),
  subject: z.string().trim().min(1, "Chọn môn.").max(30, "Tên môn dài quá."),
  sessions: z.unknown(),
  place: z.enum(PLACES as unknown as [string, ...string[]]),
  bring: z.string().max(120).default(""),
  note: z.string().max(120).default(""),
  appSlotId: z.string().uuid().nullable().default(null),
});

/** Save one extra class (new or edited). Clashes are reported, not blocked (the child decides). */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Thiếu thông tin.", 400);
  const sessions = cleanSessions(parsed.data.sessions);
  if (typeof sessions === "string") return jsonError(sessions, 400);
  try {
    const admin = createAdminClient();
    const { versions, extras } = await loadSchedule(ctx.db, [ctx.childId]);
    const old = parsed.data.id ? extras.find((e) => e.id === parsed.data.id) ?? null : null;
    if (parsed.data.id && !old) return jsonError("Không tìm thấy buổi học thêm này.", 404);
    if (parsed.data.appSlotId) {
      const { data: s } = await ctx.db.from("app_slots").select("id").eq("id", parsed.data.appSlotId).maybeSingle();
      if (!s) return jsonError("App này không có trong danh sách của con.", 400);
    }
    const fields = { subject: parsed.data.subject, sessions, place: parsed.data.place, bring: parsed.data.bring.trim(), note: parsed.data.note.trim(), app_slot_id: parsed.data.appSlotId, active: true, updated_by: ctx.childId, updated_at: new Date().toISOString() };
    const q = old
      ? admin.from("extra_classes").update(fields).eq("id", old.id).eq("child_id", ctx.childId)
      : admin.from("extra_classes").insert({ ...fields, family_id: ctx.familyId, child_id: ctx.childId });
    const { data, error } = await q.select("id").single();
    if (error || !data) throw new Error(error?.message ?? "no row");
    const busy = [...schoolBusy(versionOn(versions, localDate(new Date()))), ...extraBusy(extras, old?.id)];
    const clash = conflicts(sessions, busy);
    await scheduleAudit(ctx.familyId, ctx.childId, "schedule.extra.save", {
      child_id: ctx.childId, id: data.id, summary: `${parsed.data.subject}: ${sessionsText(sessions)}`, conflicts: clash.length,
      before: old ? extraSnapshot(old) : null,
    });
    return NextResponse.json({ ok: true, id: data.id, conflicts: clash });
  } catch (e) {
    return serverError("schedule.extra", e);
  }
}

/** Turn one extra class off (?id=…). Kept in the table so Khôi phục can bring it back. */
export async function DELETE(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!z.string().uuid().safeParse(id).success) return jsonError("Thiếu buổi học thêm.", 400);
  try {
    const { extras } = await loadSchedule(ctx.db, [ctx.childId]);
    const old = extras.find((e) => e.id === id);
    if (!old) return jsonError("Không tìm thấy buổi học thêm này.", 404);
    const { error } = await createAdminClient().from("extra_classes").update({ active: false, updated_by: ctx.childId, updated_at: new Date().toISOString() }).eq("id", id).eq("child_id", ctx.childId);
    if (error) throw new Error(error.message);
    await scheduleAudit(ctx.familyId, ctx.childId, "schedule.extra.off", { child_id: ctx.childId, id, summary: `${old.subject}: ${sessionsText(old.sessions)}`, before: extraSnapshot(old) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError("schedule.extra.off", e);
  }
}
```

`app/api/schedule/subject/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, requireChild, serverError } from "@/lib/today/service";

const bodySchema = z.object({
  key: z.string().trim().min(1).max(40),
  label: z.string().trim().max(30).default(""),
  color: z.string().regex(/^(#[0-9A-Fa-f]{6})?$/).default(""),
  bring: z.string().trim().max(120).default(""),
});

/** The child's colour / label / bring list for one subject (no restore: low stakes, no audit). */
export async function POST(request: Request) {
  const guard = await requireChild();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Thông tin môn chưa đúng.", 400);
  try {
    const { error } = await createAdminClient().from("subject_prefs").upsert(
      { child_id: ctx.childId, family_id: ctx.familyId, subject_key: parsed.data.key, label: parsed.data.label, color: parsed.data.color, bring: parsed.data.bring, updated_at: new Date().toISOString() },
      { onConflict: "child_id,subject_key" },
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError("schedule.subject", e);
  }
}
```

- [ ] **Step 4: Run** `npx vitest run tests/scheduleRoutes.test.ts && npm run typecheck && npm run lint`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/schedule/rules.ts app/api/schedule tests/scheduleRoutes.test.ts
git commit -m "feat(schedule): child routes save timetable, extra classes, subject prefs (server writes, audited)"
```

---

### Task 6: Parent restore route + Nhật ký sentences

**Files:**
- Create: `app/api/admin/schedule/restore/route.ts`, `lib/schedule/restore.ts` (pure `restorePlan`)
- Modify: `lib/admin/auditText.ts` (ACTION_GROUP + `case` lines)
- Test: `tests/scheduleRestore.test.ts`, `tests/auditText.test.ts` (add cases)

**Interfaces:**
- Produces:

```ts
// lib/schedule/restore.ts (pure)
export type RestoreStep =
  | { table: "timetables"; op: "delete"; id: string }
  | { table: "timetables"; op: "update"; id: string; values: Record<string, unknown> }
  | { table: "extra_classes"; op: "update"; id: string; values: Record<string, unknown> }
  | { error: string };
export function restorePlan(entry: { action: string; payload: unknown }): RestoreStep;
// POST /api/admin/schedule/restore { auditId } → { ok: true }
```

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from "vitest";
import { restorePlan } from "@/lib/schedule/restore";
import { auditText } from "@/lib/admin/auditText";

describe("restorePlan", () => {
  it("a new timetable version is deleted; an edited one gets its before back", () => {
    expect(restorePlan({ action: "schedule.timetable", payload: { id: "t1", before: null } })).toEqual({ table: "timetables", op: "delete", id: "t1" });
    const before = { valid_from: "2026-11-09", label: "9A13", note: "", periods: [], times: {}, uniform: {} };
    expect(restorePlan({ action: "schedule.timetable", payload: { id: "t1", before } })).toEqual({ table: "timetables", op: "update", id: "t1", values: { label: "9A13", note: "", periods: [], times: {}, uniform: {} } });
  });
  it("a new extra class is turned off; an edited or turned-off one gets its before back", () => {
    expect(restorePlan({ action: "schedule.extra.save", payload: { id: "e1", before: null } })).toEqual({ table: "extra_classes", op: "update", id: "e1", values: { active: false } });
    const before = { subject: "Văn", sessions: [], place: "home", bring: "", note: "", app_slot_id: null, active: true };
    expect(restorePlan({ action: "schedule.extra.off", payload: { id: "e1", before } })).toEqual({ table: "extra_classes", op: "update", id: "e1", values: before });
  });
  it("refuses anything else", () => {
    expect(restorePlan({ action: "homework.create", payload: {} })).toHaveProperty("error");
    expect(restorePlan({ action: "schedule.timetable", payload: { before: null } })).toHaveProperty("error");
  });
});

describe("Nhật ký sentences", () => {
  const names = new Map([["c1", "Nguyên"], ["c2", "An"]]);
  const e = (action: string, payload: Record<string, unknown>) => ({ id: "a", action, payload, actor_id: "c1", created_at: "2026-11-25T12:42:00Z" });
  it("reads like the canvas", () => {
    expect(auditText(e("schedule.timetable", { child_id: "c1", changes: ["T4 tiết 3: Thể dục → Toán"] }) as never, names).text).toBe("Nguyên sửa thời khóa biểu: T4 tiết 3: Thể dục → Toán");
    expect(auditText(e("schedule.extra.save", { child_id: "c2", summary: "Văn: T3 15:30–17:00", before: null, conflicts: 0 }) as never, names).text).toBe("An thêm học thêm Văn: T3 15:30–17:00");
    expect(auditText(e("schedule.extra.save", { child_id: "c2", summary: "Văn: T3 13:30–15:00", before: {}, conflicts: 1 }) as never, names).text).toBe("An sửa học thêm Văn: T3 13:30–15:00 · trùng giờ học ở trường");
    expect(auditText(e("schedule.extra.off", { child_id: "c2", summary: "Văn: T3 15:30–17:00" }) as never, names).text).toBe("An bỏ học thêm Văn: T3 15:30–17:00");
    expect(auditText(e("schedule.restore", { child_id: "c2" }) as never, names).text).toBe("Khôi phục lịch học của An về bản trước");
  });
});
```

(Build `e()` with the same fields as the fixtures already in `tests/auditText.test.ts`.)

- [ ] **Step 2: Run, see FAIL.**

- [ ] **Step 3: Implement**

`lib/schedule/restore.ts`:

```ts
const obj = (x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null);

/** What "Khôi phục bản trước" does for one Nhật ký entry (pure; the route runs it). */
export function restorePlan(entry: { action: string; payload: unknown }): RestoreStep {
  const p = obj(entry.payload);
  const id = typeof p?.id === "string" ? p.id : null;
  if (!p || !id) return { error: "Mục này không khôi phục được." };
  const before = p.before === null ? null : obj(p.before);
  if (entry.action === "schedule.timetable") {
    if (!before) return { table: "timetables", op: "delete", id };
    const { valid_from: _skip, ...values } = before;
    return { table: "timetables", op: "update", id, values };
  }
  if (entry.action === "schedule.extra.save" || entry.action === "schedule.extra.off") {
    return { table: "extra_classes", op: "update", id, values: before ?? { active: false } };
  }
  return { error: "Mục này không khôi phục được." };
}
```

(Add the `RestoreStep` type above it, exactly as in Interfaces. `valid_from` is excluded so the row keeps its date.)

`app/api/admin/schedule/restore/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJson, requireParent, writeAudit } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { restorePlan } from "@/lib/schedule/restore";

const bodySchema = z.object({ auditId: z.string().uuid() });

/** Parent: put back the BEFORE of one schedule change from Nhật ký (decision 21/11/2026). */
export async function POST(request: Request) {
  const guard = await requireParent();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("Thiếu mục cần khôi phục.", 400);
  // Parent session + RLS: only this family's audit rows are visible.
  const { data: entry } = await ctx.db.from("audit_log").select("id, action, payload").eq("id", parsed.data.auditId).maybeSingle();
  if (!entry) return jsonError("Không tìm thấy mục này.", 404);
  const step = restorePlan(entry);
  if ("error" in step) return jsonError(step.error, 400);
  const admin = createAdminClient();
  const q = step.op === "delete"
    ? admin.from(step.table).delete().eq("id", step.id).eq("family_id", ctx.familyId)
    : admin.from(step.table).update({ ...step.values, updated_by: ctx.userId, updated_at: new Date().toISOString() }).eq("id", step.id).eq("family_id", ctx.familyId);
  const { error } = await q;
  if (error) {
    console.error("schedule.restore failed", error.message);
    return jsonError("Không khôi phục được.", 500);
  }
  const childId = (entry.payload as Record<string, unknown> | null)?.child_id ?? null;
  await writeAudit(ctx, "schedule.restore", { child_id: childId, of: entry.id, target: step.table });
  return NextResponse.json({ ok: true });
}
```

The `delete` only removes a timetable **version the child created**: it is the undo of that create, and no other rows are touched. This is not deleting real data the family entered. Say so in the PR.

`lib/admin/auditText.ts`:
- Add to `ACTION_GROUP`: `"schedule.timetable": "homework", "schedule.extra.save": "homework", "schedule.extra.off": "homework", "schedule.restore": "homework",`
- Add these cases:

```ts
    case "schedule.timetable": {
      const changes = Array.isArray(p.changes) ? p.changes.filter((c): c is string => typeof c === "string") : [];
      const head = changes.slice(0, 3).join("; ");
      const more = changes.length > 3 ? ` (+${changes.length - 3})` : "";
      return say(changes.length > 0 ? `${kid} sửa thời khóa biểu: ${head}${more}` : `${kid} sửa đồng phục / giờ tiết`);
    }
    case "schedule.extra.save": {
      const clash = (num(p.conflicts) ?? 0) > 0 ? " · trùng giờ học ở trường" : "";
      return say(`${kid} ${p.before ? "sửa" : "thêm"} học thêm ${str(p.summary) ?? ""}${clash}`.trim());
    }
    case "schedule.extra.off":
      return say(`${kid} bỏ học thêm ${str(p.summary) ?? ""}`.trim());
    case "schedule.restore":
      return say(`Khôi phục lịch học của ${kid} về bản trước`);
```

- [ ] **Step 4: Run** `npx vitest run tests/scheduleRestore.test.ts tests/auditText.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/schedule/restore.ts app/api/admin/schedule lib/admin/auditText.ts tests/scheduleRestore.test.ts
git commit -m "feat(schedule): parent restores the previous version; Nhật ký sentences for schedule changes"
```

---

### Task 7: The child's page `/lich-hoc` (3 tabs)

**Files:**
- Create: `app/lich-hoc/page.tsx`, `app/lich-hoc/schedule-editor.tsx`, `app/lich-hoc/extra-sheet.tsx`
- Check: `proxy.ts` matcher covers `/lich-hoc` (it must NOT be excluded; only `/gia-su` is). `app/child-nav.tsx` is unchanged (the page opens from Lịch của con).

**Interfaces:**
- Consumes: GET `/api/schedule` (Task 4), the POST/DELETE routes (Task 5), `subjectRows`, `conflicts`, `schoolBusy`, `extraBusy`, `sessionsText`, `dayShort`, `PLACE_LABEL`, `SUBJECT_COLORS`, `uniformFor`, `versionOn`, `DAY_NAMES`.
- Produces: page `/lich-hoc`, regions with these accessible names (the e2e uses them):
  - `region "Thời khóa biểu tuần"`: grid buttons `"T4 tiết 3: Thể dục"` (aria-label `${dayShort} ${session==="pm"?"chiều ":""}tiết ${n}: ${subject||"trống"}`); picker `group "Chọn môn"`; button `"Lưu thời khóa biểu"`; status messages in `role="status"`.
  - Tab buttons `"Thời khóa biểu"`, `"Học thêm"`, `"Môn học"` (`role="tab"`).
  - `list "Học thêm của con"`, button `"+ Học thêm"`, dialog `"Học thêm"` with label inputs `"Môn"`, `"Thứ"`, `"Bắt đầu"`, `"Kết thúc"`, radio group `"Học ở đâu"`, input `"Cần mang"`, select `"Cô giao bài ở"` (app slots + "Không"), button `"Lưu học thêm"`, warning text starting `"Trùng giờ"`.
  - `list "Môn học của con"` rows with colour swatch buttons and a `"Cần mang"` input per row, button `"Lưu"` per row.

- [ ] **Step 1: Server page**

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SessionKeeper } from "@/app/session-keeper";
import { ScheduleEditor } from "./schedule-editor";

export const dynamic = "force-dynamic";

/** "Lịch học của con" (21/11/2026): the child edits their own timetable, extra classes, subjects. */
export default async function LichHocPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.profile?.role !== "child") redirect("/parent/timetable");
  return (
    <main className="mx-auto flex max-w-[1240px] flex-col gap-4 p-5">
      <SessionKeeper />
      <ScheduleEditor name={me.profile.display_name} color={me.profile.color ?? "#2F5D9E"} />
    </main>
  );
}
```

(`getCurrentUser` is in `lib/auth.ts`, `SessionKeeper` in `app/session-keeper.tsx`; the colour field name is the one `app/today/page.tsx` passes to TodayScreen.)

- [ ] **Step 2: Client editor — load + Thời khóa biểu tab**

`schedule-editor.tsx` (client):
- It fetches `/api/schedule` once and keeps `{ versions, extras, prefs, slots, today }` in state.
- `const current = versionOn(versions, today)`. Draft state:
  `draft: TimetableData` (copy of `current`, or a blank `{label:"",note:"",periods:[],times:{am:{"1":"07:30-08:15","2":"08:20-09:05","3":"09:20-10:05","4":"10:10-10:55","5":"11:00-11:45"}},uniform:{}}`)
  plus `validFrom` (`current?.validFrom ?? today`).
- Header: back link `‹ Góc học tập` (`href="/today"`), title `Lịch học của {name}`, the `role="tablist"` tabs.
- Version bar:
  - text `Bản đang dùng: {label} · áp dụng từ {dd/mm/yyyy}`
  - a date input labelled `Áp dụng từ ngày`: `min` = `current?.validFrom ?? today`, `max` = today + 60
  - helper text: `Trường đổi thời khóa biểu? Chọn ngày mới rồi lưu: bản cũ vẫn giữ.`
- Grid: `region "Thời khóa biểu tuần"`, columns T2…T7, rows Sáng 1–5 (+ Chiều 1–5 when any pm period or pm time exists, or after the toggle `+ Buổi chiều`).
  - Each cell is a `<button>` showing the subject (or `—`) with the subject colour from `subjectRows`.
  - Clicking a cell selects it. Changed cells get the inline style `box-shadow: inset 0 0 0 2px #D07A12`.
- Picker `group "Chọn môn"`:
  - one button per `subjectRows(...)` label
  - an `Ô trống` button
  - a text input `Môn khác` with button `Thêm`
- Times row: one `input` per period labelled `Giờ tiết {n}` (`07:30-08:15`), validated client-side with `normTime`.
- Uniform block: 6 inputs `Đồng phục T2…T7`, plus `Ngày có Thể dục mặc` (key `pe`) with helper `Để trống nếu không đổi theo môn Thể dục.`
- Save: `Lưu thời khóa biểu` POSTs `{ validFrom, data: draft }` to `/api/schedule/timetable`. On OK:
  - status `Đã lưu. Bố mẹ sẽ thấy trong Nhật ký.` plus the first change if any
  - reload `/api/schedule`
  - on error: status with the server message.

- [ ] **Step 3: Học thêm tab + `extra-sheet.tsx`**

- `list "Học thêm của con"`: each row shows `{subject}`, `sessionsText`, `PLACE_LABEL[place]`, bring and the app label, with buttons `Sửa` and `Bỏ` (`Bỏ` asks `window.confirm("Bỏ học thêm …? Bố mẹ vẫn khôi phục được.")`, then DELETE).
- `+ Học thêm` opens `<ExtraSheet>` (`role="dialog"`, `aria-label="Học thêm"`). Fields:
  - Môn: chips from `subjectRows` + free text.
  - Session rows (`Thứ` select T2…CN, `Bắt đầu` / `Kết thúc` text inputs `15:30`), `+ Thêm buổi`, max 7.
  - `Học ở đâu` radio group (Ở nhà / Trung tâm / Online).
  - `Cần mang` text.
  - `Cô giao bài ở` select: slots + `Không` (helper: `Bài trên app này sẽ được nhắc làm trước buổi học`).
- Live clash check (client, pure): `conflicts(cleanedSessions, [...schoolBusy(current), ...extraBusy(extras, editingId)])`.
  - Each clashing session row turns orange (`#FFF4E8`, border `#D07A12`) with the text `Trùng giờ {with.label} ({with.start}–{with.end}). Con kiểm lại giờ nhé.`
  - Rows without a clash show a green `Không trùng giờ học ở trường.`
- Save POSTs to `/api/schedule/extra`. The response `conflicts.length > 0` still saves (the clash is a warning) and shows the same text.

- [ ] **Step 4: Môn học tab**

- `list "Môn học của con"` from `subjectRows(current, extras, prefs)`. Each row shows:
  - colour swatches: 8 buttons with `aria-label="Màu {hex}"` and `aria-pressed`
  - the label
  - `{perWeek} tiết/tuần`
  - `Học thêm: T3, T5` when present
  - a text input labelled `Cần mang`
  - a button `Lưu`, which POSTs `/api/schedule/subject { key, label, color, bring }`
- Helper text: `Mặc định mọi môn: sách + vở. Ghi thêm đồ riêng (vd Thể dục: giày thể thao).`

- [ ] **Step 5: Check by hand, then commit**

Run: `npm run typecheck && npm run lint`.
Then `npm run dev` and open `/lich-hoc` as a child: the page cannot load without Supabase locally, so the real check is the CI e2e in Task 9.

```bash
git add app/lich-hoc
git commit -m "feat(schedule): child page Lịch học — timetable grid, extra classes with clash warnings, subjects"
```

---

### Task 8: Góc học tập + parent page wiring

**Files:**
- Modify: `app/today/calendar-card.tsx` (button), `lib/today/calendar.ts` + `lib/today/calendarServer.ts` (extra chips), `app/api/timetable/route.ts` + `app/today/school-card.tsx` (extras today / tomorrow), `app/parent/timetable/page.tsx`
- Create: `app/parent/timetable/recent-changes.tsx`
- Test: `tests/calendar.test.ts` (add a case), `tests/schedule.test.ts` (none new)

**Interfaces:**
- Consumes: `extrasOn`, `sessionsText`, `loadSchedule`.
- Produces:
  - `CalendarDay.extras: { subject: string; start: string; end: string }[]`. Always present; `[]` when none.
  - `CalendarRows` gains `extras?: readonly ExtraClass[]`; `buildCalendar(range, today, rows)` fills `CalendarDay.extras` from it (`[]` when missing).
  - GET `/api/timetable` adds `extrasToday` and `extrasNext`, each `{ subject, start, end, place, bring }[]` (`extrasNext` only when `next` is sent).

- [ ] **Step 1: Failing calendar test**

```ts
it("adds the day's extra classes (21/11/2026)", () => {
  const gs = { id: "g", childId: "c", subject: "Gia sư Anh", sessions: [{ day: 4, start: "20:30", end: "22:30" }], place: "online" as const, bring: "", note: "", appSlotId: null, active: true };
  const view = buildCalendar({ from: "2026-11-23", to: "2026-11-29" }, "2026-11-23", { ...ROWS, extras: [gs] }); // ROWS = the rows fixture the neighbouring tests use
  const thu = view.days.find((d) => d.date === "2026-11-26")!;
  expect(thu.extras).toEqual([{ subject: "Gia sư Anh", start: "20:30", end: "22:30" }]);
  expect(view.days.find((d) => d.date === "2026-11-25")!.extras).toEqual([]);
});
```

(`ROWS` stands for the existing rows fixture in `tests/calendar.test.ts`; reuse it, adding `extras`.)

- [ ] **Step 2: Run, see FAIL.**

- [ ] **Step 3: Implement**
- `lib/today/calendar.ts`: in `buildCalendar`'s per-day mapping, add `extras: extrasOn(rows.extras ?? [], date).map(({ extra, session }) => ({ subject: extra.subject, start: session.start, end: session.end }))`.
- `calendarServer.ts`: load `extra_classes` for the child with the caller's session (same select as `loadSchedule`, mapped with `fromExtraRow`) into `rows.extras`.
- `calendar-card.tsx`:
  - Under each week-day cell, render the extras as small chips: `{start} {subject}` with `bg #E3EBF6`.
  - In the card header, add `<a href="/lich-hoc" className="min-h-11 …">Sửa lịch học</a>`. A plain `<a>` is fine (same zone).
- `/api/timetable`: `const { extras } = await loadSchedule(ctx.db, [ctx.childId])`; add
  `extrasToday: extrasOn(extras, today).map(...)`, `extrasNext: next ? extrasOn(extras, next.date).map(...) : []`.
- `school-card.tsx`:
  - Under "Hôm nay ở trường", list `Học thêm hôm nay` lines (`15:30–17:00 Văn · Ở nhà`).
  - In "Chuẩn bị cho …", add `Học thêm:` lines with the bring text.
  - The uniform now already comes from `uniformFor` (Task 2).
- Parent page `app/parent/timetable/page.tsx`:
  - Per child, below the editor, add the section `Học thêm (con tự nhập)`: a list of the child's extras via `loadSchedule(ctx.db, ids)`, grouped by `childId`, read only.
  - Add a `RecentChanges` section that loads the last 20 `audit_log` rows with `action like 'schedule.%'` for the family (parent session) and renders `auditText(...)`, the time, and a `Khôi phục bản trước` button for `schedule.timetable` / `schedule.extra.*`. The button is two-tap like `done-button.tsx`: first tap `Khôi phục bản trước`, then `Bấm lần nữa để khôi phục`. It POSTs `/api/admin/schedule/restore`, then `router.refresh()`.

- [ ] **Step 4: Run** `npx vitest run && npm run typecheck && npm run lint`. Expected: all green (fix any older calendar test whose fixtures lack `extras`).

- [ ] **Step 5: Commit**

```bash
git add lib/today/calendar.ts lib/today/calendarServer.ts app/today/calendar-card.tsx app/api/timetable/route.ts app/today/school-card.tsx app/parent/timetable tests/calendar.test.ts
git commit -m "feat(schedule): extra classes in Lịch của con and the school card; parent sees changes and restores"
```

---

### Task 9: e2e + docs + PR

**Files:**
- Create: `e2e/s-lich-hoc.spec.ts`
- Modify: `docs/SPEC.md` (one row in §2.5 / decision log), `docs/PROGRESS.md` (one row), `CLAUDE.md` Key decisions (one line: decision 21/11 on the child's schedule writes)

- [ ] **Step 1: Write the e2e** (pattern of `e2e/s-tkb.spec.ts`: service client, child password reset, cleanup in `finally`)

```ts
test("Lịch học: the child edits the timetable + adds an extra class; the parent sees it and restores", async ({ page, browser }) => {
  const db = admin();
  const { data: kid } = await db.from("profiles").select("id, family_id, display_name").eq("role", "child").single();
  const { data: tt } = await db.from("timetables").insert({
    family_id: kid?.family_id, child_id: kid?.id, valid_from: "2026-11-02", label: "E2E",
    periods: [{ day: 3, session: "am", n: 3, subject: "Thể dục" }], times: { am: { "3": "09:20-10:05" } }, uniform: { "3": "Áo trắng", pe: "Áo xanh lá e2e" },
  }).select("id").single();
  try {
    // child
    const ctx = await browser.newContext();
    const k = await ctx.newPage();
    /* reset password + login exactly as s-tkb.spec.ts does */
    await k.goto("/lich-hoc");
    const grid = k.getByRole("region", { name: "Thời khóa biểu tuần" });
    await grid.getByRole("button", { name: "T4 tiết 3: Thể dục" }).click();
    await k.getByRole("group", { name: "Chọn môn" }).getByLabel("Môn khác").fill("Toán e2e");
    await k.getByRole("group", { name: "Chọn môn" }).getByRole("button", { name: "Thêm" }).click();
    await k.getByRole("button", { name: "Lưu thời khóa biểu" }).click();
    await expect(k.getByRole("status")).toContainText("Đã lưu");

    await k.getByRole("tab", { name: "Học thêm" }).click();
    await k.getByRole("button", { name: "+ Học thêm" }).click();
    const sheet = k.getByRole("dialog", { name: "Học thêm" });
    await sheet.getByLabel("Môn").fill("Văn e2e");
    await sheet.getByLabel("Thứ").selectOption("3");
    await sheet.getByLabel("Bắt đầu").fill("09:30");
    await sheet.getByLabel("Kết thúc").fill("10:30");
    await expect(sheet.getByText(/^Trùng giờ/)).toBeVisible(); // clashes with 09:20–10:05
    await sheet.getByRole("button", { name: "Lưu học thêm" }).click();
    await expect(k.getByRole("list", { name: "Học thêm của con" })).toContainText("Văn e2e");

    // parent
    await login(page, env.parentEmail, env.parentPassword);
    await page.goto("/parent/timetable");
    const recent = page.getByRole("region", { name: "Con sửa gần đây" });
    await expect(recent).toContainText("T4 tiết 3: Thể dục → Toán e2e");
    await expect(recent).toContainText("Văn e2e");
    const row = recent.getByRole("listitem").filter({ hasText: "sửa thời khóa biểu" });
    await row.getByRole("button", { name: "Khôi phục bản trước" }).click();
    await row.getByRole("button", { name: "Bấm lần nữa để khôi phục" }).click();
    await expect.poll(async () => (await db.from("timetables").select("periods").eq("id", tt!.id).single()).data?.periods?.[0]?.subject).toBe("Thể dục");
    await ctx.close();
  } finally {
    await db.from("extra_classes").delete().eq("child_id", kid?.id as string).like("subject", "%e2e%");
    await db.from("timetables").delete().eq("id", tt?.id as string);
  }
});
```

(The `valid_from` 2026-11-02 is in the past, so it is the version in force: the child edits it in place. If CI runs on a date before 2026-11-02, use `localDate(new Date())` instead.)

- [ ] **Step 2: Local checks**

Run: `npm run typecheck && npm run lint && npm test` and `TEST_DB_NAME=lh1 PGHOST=/tmp PGPORT=5433 PGUSER=postgres bash scripts/test-db.sh`. Expected: green.

- [ ] **Step 3: Docs rows + commit + push + PR**

```bash
git add e2e/s-lich-hoc.spec.ts docs/SPEC.md docs/PROGRESS.md CLAUDE.md
git commit -m "test(schedule): e2e for the child's schedule; docs for decision 21/11"
git push -u origin feature/s-lh1-lich-hoc
gh api repos/haleytruong89-moon/study-launcher/pulls -f title="feat(schedule): Lịch học con tự quản — Lát 1" -f head=feature/s-lh1-lich-hoc -f base=main -F body=@/tmp/pr-lh1.md --jq .html_url
```

PR body (Vietnamese) must contain:
- what was done
- how to test on the preview, step by step
- **"Có đụng database không: Có — `0025_child_schedule.sql` tự chạy khi merge: thêm 2 bảng `extra_classes`, `subject_prefs` (con chỉ đọc, máy chủ ghi) + 1 cột `timetables.updated_by`. Không sửa/xóa dữ liệu cũ."**
- the note on the restore delete (it only removes a version the child created)
- **the ready-to-paste lists for the two children** (below)
- the closing lines of the PR template

Send the clickable PR link to the parent (standing instruction 16/11).

- [ ] **Step 4: Wait for CI, read failures via check-run annotations, fix, push.**

**Data for the parent / children to enter after merge.** Real data is never seeded by migration. Put this block in the PR body:

| Con | Học thêm | Buổi | Ở đâu |
|---|---|---|---|
| Nguyên | Gia sư Tiếng Anh | T5, T6, T7, CN 20:30–22:30 | Online · Cô giao bài ở: English OS |
| Nguyên | Văn | T3 13:30–15:30 · T5 14:30–16:30 | |
| Nguyên | Toán | T2 14:00–16:00 · T7 13:30–15:30 | |
| Nguyên | Tiếng Anh HSG | T7 15:45–17:15 | |
| An | Văn | T3 15:30–17:00 · T5 13:00–14:30 | |
| An | Tiếng Anh | T2 15:30–17:30 · T6 14:00–16:00 | Cô giao bài ở: English OS |

Nguyên's timetable: tick "Ngày có Thể dục mặc: Đồng phục thể dục (áo xanh lá)". Weekday uniforms:
T2 and T6 "Áo đồng phục lớp"; T3, T4, T5 and T7 "Áo trắng". The PE rule overrides T4 and T7.

---

# LÁT 2 — Ngày mai + "Làm trước buổi học thêm" (branch `feature/s-lh2-ngay-mai`, SQL 0026)

Starts after Lát 1 is merged. Same task rhythm (failing test → implement → pass → commit).

## File map (Lát 2)

| File | Responsibility |
|---|---|
| `supabase/migrations/0026_prep_checks.sql` | `prep_checks (child_id, family_id, for_date, ticked text[], done_at, updated_at)`, PK (child_id, for_date); RLS parent select family, child select own; service_role writes |
| `lib/dayState/types.ts`, `lib/dayState/tasks.ts` (modify) | `TaskView.appSlotId?: string \| null` (display only) |
| `lib/schedule/classPrep.ts` (new, pure) | `classPrep(items, extras, nowMs, today)` → tasks to do before the next class |
| `lib/schedule/prep.ts` (new, pure) | `prepItems(...)` → the "Ngày mai" checklist |
| `app/today/use-school-day.ts` (new) | one fetch of `/api/timetable` shared by SchoolCard, PrepCard, StudyCorner |
| `app/today/prep-card.tsx` (new) | "Chuẩn bị cho ngày mai" with tick boxes |
| `app/api/prep/route.ts` (new) | POST tick / untick (child, server write) |
| `app/today/study-corner.tsx`, `app/today/today-screen.tsx` (modify) | prep-first order when no saved plan + chip on tasks |
| `lib/parent/load.ts`, parent ChildCard (modify) | "Chuẩn bị cho ngày mai: ✓ 19:50 / 2/4 dòng / chưa" |

### Task 10: `TaskView.appSlotId` (display field)

- Test (`tests/dayState.test.ts`): a template with `appSlotId: "s1"` gives `item.appSlotId === "s1"`; homework gives `null`.
- Implement:
  - `types.ts`: `appSlotId?: string | null;` with the comment "21/11/2026: which app slot the task opens (display only; Lát 2 'làm trước buổi học thêm')".
  - `tasks.ts`: the template branch gets `appSlotId: placeholder ? null : t.appSlotId`; the homework branch gets `appSlotId: null`.
- Run the full Vitest suite: `computeDayState` snapshots, if any, gain the field. That is accepted because lock outputs are unchanged.
- Commit: `feat(day): expose the task's app slot (display only)`.

### Task 11: `classPrep` — the "làm trước" rule (pure)

**Interfaces:**

```ts
export interface ClassPrep { taskKey: string; label: string; startsAtMs: number; extraId: string }
/**
 * Parent 21/11/2026: before a học thêm class, the homework the teacher gives on its app comes first
 * (English OS for Tiếng Anh; the Toán app when it exists). A task matches a class that starts LATER
 * TODAY or TOMORROW when: the class names an app slot and the task opens that slot; or the class names
 * none and the task is a set task (template) of the same subject (subjectKey). School homework is
 * never matched. Done tasks are skipped. Display + order only.
 */
export function classPrep(items: readonly TaskView[], extras: readonly ExtraClass[], nowMs: number, today: string): ClassPrep[];
```

Tests (write first):

```ts
const eng = { key: "t:eng", source: "template", part: 1, subject: "English", appSlotId: "os", state: "todo" } as TaskView;
const math = { key: "t:math", source: "template", part: 1, subject: "Math", appSlotId: "mos", state: "todo" } as TaskView;
const hwToan = { key: "h:1", source: "homework", part: 1, subject: "Toán", title: "Toán", appSlotId: null, state: "todo" } as TaskView;
const gs = { id: "g", childId: "n", subject: "Gia sư Tiếng Anh", sessions: [{ day: 4, start: "20:30", end: "22:30" }], place: "online", bring: "", note: "", appSlotId: "os", active: true } as ExtraClass;
const toan = { ...gs, id: "t", subject: "Toán", sessions: [{ day: 6, start: "13:30", end: "15:30" }], appSlotId: null };
// Thursday 26/11 16:00 VN = 09:00Z
const thu16 = Date.parse("2026-11-26T09:00:00Z");
it("tonight's online class pulls its app homework first", () => {
  expect(classPrep([eng, math], [gs], thu16, "2026-11-26")).toEqual([{ taskKey: "t:eng", label: "Trước buổi Gia sư Tiếng Anh 20:30 tối nay", startsAtMs: Date.parse("2026-11-26T13:30:00Z"), extraId: "g" }]);
});
it("after the class has started it no longer counts for today", () => {
  expect(classPrep([eng], [gs], Date.parse("2026-11-26T13:40:00Z"), "2026-11-26")).toEqual([]);
});
it("tomorrow's class counts too; without an app slot, same-subject set tasks match, school homework never", () => {
  // Friday 27/11 → Saturday Toán 13:30
  const fri = Date.parse("2026-11-27T10:00:00Z");
  expect(classPrep([math, hwToan], [toan], fri, "2026-11-27").map((p) => [p.taskKey, p.label])).toEqual([["t:math", "Mai học thêm Toán 13:30"]]);
});
it("done tasks are skipped", () => {
  expect(classPrep([{ ...eng, state: "done" }], [gs], thu16, "2026-11-26")).toEqual([]);
});
```

Label rule: same day → `Trước buổi {subject} {start} {start >= "18:00" ? "tối nay" : "chiều nay"}`; tomorrow → `Mai học thêm {subject} {start}`.
When several classes match one task, keep the earliest. Times use `atLocalTime(date, start)` from `@/lib/time`.
Commit: `feat(schedule): làm trước buổi học thêm — match app homework to the next class`.

### Task 12: Prep-first order + chip in Góc học tập

- `app/today/use-school-day.ts`: a hook returning `{ data, reload }`. It moves the fetch loop out of `school-card.tsx` (same 15-minute interval). `/api/timetable` already returns `extras` (Lát 1); add the full `extras: ExtraClass[]` to the response.
- `study-corner.tsx`:
  - `const prep = classPrep(allItems, extras, ctx.nowMs, s.localDate)`
  - `const prepKeys = prep.map((p) => p.taskKey)`
  - `const list = orderedToday(s, plan ?? (prepKeys.length ? prepKeys : null))`, so the child's own saved order always wins.
  - Each matching row gets a chip under the tag pill, `background #FFF4E8; color #8A4A07`: `⏰ {label}`.
  - The work panel shows the same chip.
- `today-screen.tsx`: `const next = nextFromPlan(s, view.plan) ?? nextFromPlan(s, prepKeys) ?? nextTask(s);` (`prepKeys` comes from the same hook).
- Test (pure): `orderedToday(state, ["t:eng"])` puts `t:eng` first; that already holds. Add an e2e in Lát 2's spec:
  1. Insert an extra class tonight 23:00 with `app_slot_id` set to the slot of an existing e2e template.
  2. Check the row shows `Trước buổi`.
  3. Check that row is first in `Thứ tự hôm nay` when no plan is saved.
  4. Clean up.
- Commit: `feat(study): homework for the next extra class comes first, with a chip`.

### Task 13: "Chuẩn bị cho ngày mai" checklist (SQL 0026 + route + card + parent line)

- SQL `0026_prep_checks.sql`, same structure as 0025:

```sql
create table if not exists public.prep_checks (
  child_id   uuid not null references public.profiles (id) on delete cascade,
  family_id  uuid not null references public.families (id) on delete cascade,
  for_date   date not null,
  ticked     text[] not null default '{}',
  done_at    timestamptz,
  updated_at timestamptz not null default now(),
  primary key (child_id, for_date),
  constraint prep_checks_ticked_len check (cardinality(ticked) <= 20)
);
```

  It also gets: the `(child_id, family_id)` FK DO-block; RLS on; `revoke all`; `grant select` to authenticated; `grant all` to service_role; policies `parent_select` (family) and `child_select_own`. Add the RLS test block (child sees own 1, parent sees family, authenticated cannot INSERT).

- `lib/schedule/prep.ts`:

```ts
export interface PrepItem { key: "books" | "bring" | "uniform" | "extras" | `hw:${string}`; title: string; text: string; auto: boolean; done: boolean }
export function prepItems(input: {
  plan: DayPlan | null;                       // next school day (nextSchoolDay)
  extrasNext: { extra: ExtraClass; session: ExtraSession }[]; // extrasOn(extras, nextDate)
  rows: SubjectRow[];                         // subjectRows(...) for bring lists
  prep: ClassPrep[]; items: TaskView[];       // homework to finish before tomorrow's classes
  ticked: readonly string[];
}): PrepItem[];
export const tickableKeys = (items: PrepItem[]) => items.filter((i) => !i.auto).map((i) => i.key);
```

  - `books` = unique subjects of `plan`. Title `Sách vở {n} môn`; text e.g. `Toán (2 tiết) · Địa lí · Âm nhạc · Lịch sử`.
  - `bring` = the non-empty `rows.bring` of those subjects. Omit the item when empty.
  - `uniform` = `plan.uniform`. Omit when null.
  - `extras` = one line per class, `14:30–16:30 Văn · vở…`. Omit when none.
  - `hw:<taskKey>` = auto items `Bài {taskName} trước buổi {subject}`, `done = task.state === "done"`. These are not tickable.
  - Tests:
    - the Nguyên Thursday example from the canvas (4 tickable items + 1 auto English OS item when the online class is that evening)
    - An Monday (uniform from the weekday table)
    - empty plan → `[]`.

- `app/api/prep/route.ts` POST `{ date, key, on }` (child):
  - Checks that `date` is the next school day **or** tomorrow.
  - Recomputes the item list server-side (loadSchedule + readToday), so only real tickable keys are kept.
  - Upserts `ticked` via service_role.
  - Sets `done_at` = now when every tickable key is ticked; clears it otherwise.
  - Returns `{ ticked, doneAt }`.
- `app/today/prep-card.tsx`: shows when `next` is sent (from 19:00) **or** when today's Phần 1 + Phần 2 are complete (state from TodayView). It replaces the "Chuẩn bị" block of `school-card.tsx`.
  - UI as on canvas screen 1: tick rows ≥ 44px, `aria-pressed`, the done message `Xong chuẩn bị cặp.`
  - `/api/timetable` must send `next` also before 19:00 when the day is complete. Pass a `complete=1` query from the client; the server re-checks with `readToday`.
- Parent: in `lib/parent/load.ts`, read `prep_checks` for each child with `for_date > today` (smallest). In the ChildCard add the line `Chuẩn bị cho ngày mai: ✓ {HH:MM}` / `{n}/{m} dòng` / `chưa`.
- e2e `e2e/s-ngay-mai.spec.ts`:
  1. Insert a timetable with a lesson every weekday and an extra class tomorrow.
  2. Mark today's tasks done via the API helpers used in `flow.spec.ts`.
  3. Tick all rows, check the done message.
  4. As the parent, see `Chuẩn bị cho ngày mai: ✓`.
  5. Clean up.
- PR: SQL 0026 auto-runs on merge (one new table, no data changed). Send the link.

---

# LÁT 3 — "Chiều nay" (outline; its own plan is written when Lát 2 is merged)

- Pure `afternoonStrip(versions, extras, date, nowMs)` → blocks
  `{ start, end, kind: "school" | "extra" | "free", label }` from 12:00 to 22:30, using `schoolBusy` + `extrasOn`.
- Card on Hôm nay (canvas screen 5): HTML rows with % widths. No new SQL.
- Not a lock rule; it shows time only.

## Open points (not blocking)

- **Online gia sư (Nguyên, T5–CN 20:30–22:30): which platform?**
  - Google Meet and Zalo are already in the default allowlist.
  - Zoom / Teams need a parent-approved allowlist row before the first class (Thêm → Trang được mở). No code change.
- **Toán app:** "Cô giao bài ở" lists only active, non-placeholder app slots. When the Toán app goes live as a slot, the child picks it on the Toán extra class and Task 11 works unchanged.

## Self-review (done)

- **Spec coverage:**
  - Decisions 1–6:
    - Decision 1 → Tasks 7–8.
    - Decision 2 → Tasks 5–6.
    - Decision 3 → Task 13.
    - Decision 4 → Tasks 3 and 7.
    - Decision 5 → Task 2.
    - Decision 6 → Task 7 (uniform inputs).
  - Canvas screens:
    - 1 → Tasks 8 and 13.
    - 2 → Task 7.
    - 3 → Task 7.
    - 4 → Task 7.
    - 5 → Lát 3.
    - 6 → Tasks 8 and 13.
  - New 17:05 requirement → Tasks 10–12 (+ the `hw:` items in Task 13).
  - Data from 21/11 → Task 9 PR block.
- **Placeholders:** two spots say "copy the call / import lines from file X". These exist only because the exact builder and helper names must be read from the file; each names the file and what to copy.
- **Types:**
  - `ExtraClass`, `ExtraSession`, `Busy`, `SubjectRow`, `ClassPrep`, `PrepItem` are defined once (Tasks 3, 11, 13) and used with the same fields afterwards.
  - Weekday ranges: 1..6 in timetables, 1..7 in extra classes.
