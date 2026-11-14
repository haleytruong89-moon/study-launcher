#!/usr/bin/env bash
# Applies supabase/migrations/*.sql (twice, to prove idempotency) to a throwaway database
# and runs the RLS smoke test. Needs a Postgres reachable via the standard PG* env vars
# (PGHOST, PGPORT, PGUSER, PGPASSWORD) with permission to create a database.
# Used by CI (.github/workflows/ci.yml). Never touches the real Supabase project.
# Any SQL error makes this script exit non-zero.
set -euo pipefail

cd "$(dirname "$0")/.."
DB="${TEST_DB_NAME:-study_launcher_test}"
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
PSQL=(psql -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"
"${PSQL[@]}" -d "${DB}" -f supabase/tests/00_supabase_stub.sql

for pass in 1 2; do
  echo "== applying migrations (pass ${pass})"
  for f in supabase/migrations/*.sql; do
    "${PSQL[@]}" -d "${DB}" -f "$f"
  done
done

echo "== RLS smoke test"
# The test reports progress with NOTICE, so it must run with notices enabled.
out="$(mktemp)"
if ! PGOPTIONS="-c client_min_messages=notice" "${PSQL[@]}" -d "${DB}" -f supabase/tests/rls_test.sql >"$out" 2>&1; then
  cat "$out"
  echo "RLS test FAILED" >&2
  exit 1
fi
grep -E "NOTICE:  ok|RLS OK" "$out" | sed 's/^.*NOTICE:  //'
grep -q "RLS OK" "$out" || { echo "RLS test did not finish" >&2; exit 1; }

echo "== RLS test: schema tutor (gia-su-ai)"
out2="$(mktemp)"
if ! PGOPTIONS="-c client_min_messages=notice" "${PSQL[@]}" -d "${DB}" -f supabase/tests/rls_tutor_test.sql >"$out2" 2>&1; then
  cat "$out2"
  echo "tutor RLS test FAILED" >&2
  exit 1
fi
grep -E "NOTICE:  ok|TUTOR RLS OK" "$out2" | sed 's/^.*NOTICE:  //'
grep -q "TUTOR RLS OK" "$out2" || { echo "tutor RLS test did not finish" >&2; exit 1; }
