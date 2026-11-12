#!/usr/bin/env bash
# Tests db-guard.sh and reset.sql on a THROWAWAY local Postgres (same PG* env vars as
# scripts/test-db.sh; CI runs it in the "database" job). Never touches Supabase.
# If a Supabase CLI is on PATH (or SUPABASE_BIN is set) the migrations are applied with
# `supabase db push --db-url ... --include-all`, exactly like the workflows; otherwise with psql.
set -euo pipefail
cd "$(dirname "$0")/../.."

DB="${TEST_DB_NAME:-study_launcher_preview_reset_test}"
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
PSQL=(psql -X -v ON_ERROR_STOP=1 -q)
host="${PGHOST:-127.0.0.1}"
[[ "$host" == /* ]] && host=127.0.0.1   # the CLI needs TCP
url="postgresql://${PGUSER:-postgres}${PGPASSWORD:+:$PGPASSWORD}@${host}:${PGPORT:-5432}/${DB}?sslmode=disable"
SUPABASE_BIN="${SUPABASE_BIN:-$(command -v supabase || true)}"

apply_migrations() {
  if [ -n "$SUPABASE_BIN" ]; then
    "$SUPABASE_BIN" db push --db-url "$url" --include-all --skip-vault --yes >/dev/null
  else
    for f in supabase/migrations/*.sql; do "${PSQL[@]}" -d "$DB" -f "$f"; done
  fi
}
q() { "${PSQL[@]}" -At -d "$DB" -c "$1"; }
pass() { echo "ok   $1"; }
die() { echo "FAIL: $1" >&2; exit 1; }

"${PSQL[@]}" -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"
"${PSQL[@]}" -d "$DB" -f supabase/tests/00_supabase_stub.sql
q "alter table auth.users add column if not exists email text" >/dev/null   # the stub has no e-mail
apply_migrations
[ "$(q "select count(*) from pg_tables where schemaname = 'public'")" -gt 10 ] || die "migrations did not create tables"
if [ -n "$SUPABASE_BIN" ]; then pass "migrations applied (supabase db push)"; else pass "migrations applied (psql)"; fi

# A preview-like database: test accounts only, with a family.
q "insert into auth.users (id, email) values
     ('11111111-1111-4111-8111-111111111111', 'phu-huynh-thu@example.com'),
     ('22222222-2222-4222-8222-222222222222', 'con-a@study-launcher.local')" >/dev/null
q "insert into public.families (id, name) values ('33333333-3333-4333-8333-333333333333', 'Gia đình thử (preview)')" >/dev/null
q "insert into public.profiles (id, family_id, role, display_name) values
     ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'parent', 'Phụ huynh thử')" >/dev/null

PREVIEW_DB_URL="$url" bash scripts/preview-db/db-guard.sh >/dev/null || die "db-guard refused a test-only database"
pass "db-guard accepts a database with test accounts only"

# A production-like database: one real e-mail.
q "insert into auth.users (id, email) values ('44444444-4444-4444-8444-444444444444', 'someone@gmail.com')" >/dev/null
if PREVIEW_DB_URL="$url" bash scripts/preview-db/db-guard.sh >/dev/null; then die "db-guard accepted a real e-mail"; fi
pass "db-guard refuses a database with a real e-mail"
q "insert into auth.users (id, email) values ('55555555-5555-4555-8555-555555555555', null)" >/dev/null
q "delete from auth.users where id = '44444444-4444-4444-8444-444444444444'" >/dev/null
if PREVIEW_DB_URL="$url" bash scripts/preview-db/db-guard.sh >/dev/null; then die "db-guard accepted an account without e-mail"; fi
pass "db-guard refuses an account without e-mail"
q "update auth.users set email = 'Me@Example.ORG' where id = '55555555-5555-4555-8555-555555555555'" >/dev/null
if "${PSQL[@]}" -d "$DB" -f scripts/preview-db/reset.sql >/dev/null 2>&1; then die "reset.sql ran on a database with a real e-mail"; fi
[ "$(q "select count(*) from public.families")" = "1" ] || die "reset.sql dropped data although it refused"
pass "reset.sql refuses (and rolls back) when a real e-mail exists"
if PREVIEW_DB_URL="postgresql://nobody@${host}:1/none?sslmode=disable&connect_timeout=2" bash scripts/preview-db/db-guard.sh >/dev/null 2>&1; then
  die "db-guard passed without a database"
fi
pass "db-guard fails closed when it cannot connect"

# Back to test accounts only: the reset goes through.
q "delete from auth.users where id = '55555555-5555-4555-8555-555555555555'" >/dev/null
"${PSQL[@]}" -d "$DB" -f scripts/preview-db/reset.sql
[ "$(q "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'")" = "0" ] || die "public not empty after reset"
[ "$(q "select count(*) from pg_namespace where nspname = 'supabase_migrations'")" = "0" ] || die "migration history kept"
[ "$(q "select has_schema_privilege('anon', 'public', 'usage')")" = "t" ] || die "anon lost usage on public"
pass "reset.sql empties public and the migration history"

apply_migrations
apply_migrations   # second run: nothing to do / idempotent
[ "$(q "select count(*) from pg_tables where schemaname = 'public'")" -gt 10 ] || die "migrations not re-applied after reset"
[ "$(q "select count(*) from public.families")" = "0" ] || die "old rows survived the reset"
pass "migrations re-applied from scratch after reset"

"${PSQL[@]}" -d postgres -c "drop database if exists ${DB}"
echo "preview reset: all tests passed"
