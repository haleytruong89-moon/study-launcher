#!/usr/bin/env bash
# Applies supabase/migrations/*.sql (twice, to prove idempotency) to a throwaway database
# and runs the RLS smoke test. Needs a Postgres reachable via the standard PG* env vars
# (PGHOST, PGPORT, PGUSER, PGPASSWORD) with permission to create a database.
# Used by CI (.github/workflows/ci.yml). Never touches the real Supabase project.
set -euo pipefail

cd "$(dirname "$0")/.."
DB="${TEST_DB_NAME:-study_launcher_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"
"${PSQL[@]}" -d "${DB}" -f supabase/tests/00_supabase_stub.sql

for pass in 1 2; do
  echo "== applying migrations (pass ${pass})"
  for f in supabase/migrations/*.sql; do
    "${PSQL[@]}" -d "${DB}" -f "$f" 2>&1 | grep -v "NOTICE" || true
  done
done

echo "== RLS smoke test"
"${PSQL[@]}" -d "${DB}" -f supabase/tests/rls_test.sql 2>&1 | grep -E "NOTICE:  ok|ERROR|FAIL|RLS OK" | sed 's/^.*NOTICE:  //'
