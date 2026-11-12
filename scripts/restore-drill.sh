#!/usr/bin/env bash
# Backup restore drill (Đợt 3, C3). Decrypts one weekly backup (.tar.gpg from
# .github/workflows/backup.yml: public.dump + auth.dump, pg_dump custom format) and restores it
# into a FRESH THROWAWAY database on a LOCAL Postgres, then prints only:
#   - the number of rows per table (public + auth), and
#   - the newest task_runs.local_date.
# Never row contents: children's data must not appear in logs. Error output is reduced to the
# error lines, with quoted values and key values masked.
#
# Usage:
#   BACKUP_PASSPHRASE=... PGHOST=localhost PGUSER=postgres PGPASSWORD=... \
#     bash scripts/restore-drill.sh path/to/study-launcher-YYYYMMDD.tar.gpg
# Optional env: RESTORE_DB_NAME (default restore_drill, must start with "restore_"),
#               MAX_AGE_DAYS (default 8, from the date in the file name).
# Used by .github/workflows/restore-drill.yml (Postgres 17 service container). pg_restore must be
# at least the version of the pg_dump that wrote the backup (production: 17).
# Refuses any PGHOST other than localhost / a socket directory: it never touches Supabase.
set -euo pipefail

cd "$(dirname "$0")/.."
file="${1:?usage: restore-drill.sh <backup .tar.gpg>}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is not set}"
DB="${RESTORE_DB_NAME:-restore_drill}"
MAX_AGE_DAYS="${MAX_AGE_DAYS:-8}"

case "${PGHOST:-}" in
  localhost | 127.0.0.1 | ::1 | /*) ;;
  *) echo "Refusing: PGHOST must be a local throwaway Postgres (localhost or a socket directory)." >&2; exit 1 ;;
esac
case "$DB" in
  restore_*) ;;
  *) echo "Refusing: RESTORE_DB_NAME must start with restore_ (the database is dropped and recreated)." >&2; exit 1 ;;
esac
[ -f "$file" ] || { echo "Backup file not found: $file" >&2; exit 1; }

# Age: the backup job names the file study-launcher-YYYYMMDD.tar.gpg (UTC date).
stamp="$(basename "$file" | sed -nE 's/^study-launcher-([0-9]{8})\.tar\.gpg$/\1/p')"
[ -n "$stamp" ] || { echo "Unexpected backup file name: $(basename "$file")" >&2; exit 1; }
age_days=$(( ($(date -u +%s) - $(date -u -d "$stamp" +%s)) / 86400 ))
echo "Backup: $(basename "$file") ($age_days day(s) old)"
if [ "$age_days" -gt "$MAX_AGE_DAYS" ]; then
  echo "FAIL: the backup is older than $MAX_AGE_DAYS days." >&2
  exit 1
fi

export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)
work="$(mktemp -d)"
cleanup() {
  rm -rf "$work"
  "${PSQL[@]}" -d postgres -c "drop database if exists ${DB}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Show only the error lines of a tool's output, with values masked.
masked_errors() {
  grep -E 'error|ERROR|FATAL' "$1" | grep -vE 'DETAIL|CONTEXT|^Command was' \
    | sed -E "s/\"[^\"]*\"/\"…\"/g; s/'[^']*'/'…'/g; s/\)=\([^)]*\)/)=(…)/g" | cut -c1-300 | head -20 >&2 || true
}
fail() {
  echo "FAIL: $1" >&2
  [ -n "${2:-}" ] && masked_errors "$2"
  exit 1
}

echo "== decrypt"
export GNUPGHOME="$work/gnupg"
mkdir -m 700 "$GNUPGHOME"
printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 0 \
  --decrypt --output "$work/backup.tar" "$file" 2>"$work/gpg.err" || fail "could not decrypt (wrong BACKUP_PASSPHRASE?)" "$work/gpg.err"
tar -C "$work" -xf "$work/backup.tar" public.dump auth.dump 2>"$work/tar.err" || fail "public.dump / auth.dump missing in the backup" "$work/tar.err"
rm -f "$work/backup.tar"
echo "pg_restore: $(pg_restore --version)"

echo "== fresh database ${DB}"
"${PSQL[@]}" -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"
# Roles, auth.uid() and a minimal auth.users / storage, as for the CI tests.
"${PSQL[@]}" -d "$DB" -f supabase/tests/00_supabase_stub.sql

# auth.dump is data only (auth.users + auth.identities). The stub's auth tables are minimal, so
# add every column the dump carries, as text (the drill only counts rows). auth.users.id stays
# uuid: public.profiles references it. Only the COPY header lines are read here.
pg_restore --data-only -f - "$work/auth.dump" | grep -E '^COPY auth\.[a-z_]+ \(' >"$work/auth.copy" || true
[ -s "$work/auth.copy" ] || fail "auth.dump holds no table data"
while IFS= read -r line; do
  table="$(sed -E 's/^COPY (auth\.[a-z_]+) \(.*$/\1/' <<<"$line")"
  cols="$(sed -E 's/^COPY auth\.[a-z_]+ \((.*)\) FROM stdin;$/\1/' <<<"$line")"
  sql="create table if not exists ${table} ();"
  IFS=',' read -ra list <<<"$cols"
  for c in "${list[@]}"; do
    c="${c# }"
    sql+=" alter table ${table} add column if not exists ${c} text;"
  done
  "${PSQL[@]}" -d "$DB" -c "$sql"
done <"$work/auth.copy"

echo "== restore auth.dump"
pg_restore --no-owner --no-privileges --data-only --exit-on-error -d "$DB" "$work/auth.dump" 2>"$work/auth.err" \
  || fail "auth.dump did not restore" "$work/auth.err"

echo "== restore public.dump"
# A dump of the public schema may create the schema itself; start from none in that case.
if pg_restore -l "$work/public.dump" | grep -qE '^[0-9]+; [0-9]+ [0-9]+ SCHEMA - public '; then
  "${PSQL[@]}" -d "$DB" -c "drop schema public cascade"
fi
pg_restore --no-owner --no-privileges --exit-on-error -d "$DB" "$work/public.dump" 2>"$work/public.err" \
  || fail "public.dump did not restore" "$work/public.err"

echo "== rows per table"
count_sql="$("${PSQL[@]}" -At -d "$DB" -c "
  select string_agg(format('select %L, count(*) from %I.%I', n.nspname || '.' || c.relname, n.nspname, c.relname),
                    ' union all ' order by n.nspname desc, c.relname)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p') and n.nspname in ('public', 'auth')")"
counts="$("${PSQL[@]}" -At -F ' ' -d "$DB" -c "$count_sql")"
printf '%-36s %s\n' "table" "rows"
while read -r t n; do printf '%-36s %s\n' "$t" "$n"; done <<<"$counts"
newest="$("${PSQL[@]}" -At -d "$DB" -c "select coalesce(max(local_date)::text, '(none)') from public.task_runs")"
echo "newest task_runs.local_date: $newest"
echo "(public.by_* tables are empty by design: the backup never keeps Góc bình yên rows.)"

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Diễn tập khôi phục: OK"
    echo
    echo "Bản sao lưu \`$(basename "$file")\` ($age_days ngày tuổi) · ngày học mới nhất trong task_runs: **$newest**"
    echo
    echo "| Bảng | Số dòng |"
    echo "|---|---|"
    while read -r t n; do echo "| $t | $n |"; done <<<"$counts"
  } >>"$GITHUB_STEP_SUMMARY"
fi

n_of() { awk -v t="$1" '$1 == t { print $2 }' <<<"$counts"; }
[ "$(n_of public.families)" -ge 1 ] 2>/dev/null || fail "no family in the backup: it looks empty"
[ "$(n_of auth.users)" -ge 1 ] 2>/dev/null || fail "no login account in the backup: it looks empty"
echo "RESTORE DRILL OK"
