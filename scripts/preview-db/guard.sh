#!/usr/bin/env bash
# Safety gate for the PREVIEW database workflows (.github/workflows/preview-db*.yml).
# Runs BEFORE any connection to a database. Never prints a URL, key or project ref.
#
#   bash scripts/preview-db/guard.sh push|reset
#
# Exit codes: 0 = safe to continue · 10 = PREVIEW_DB_URL not set (push: skip cleanly) · 1 = REFUSED.
#
# Env (from GitHub secrets / variables):
#   PREVIEW_DB_URL          connection string of the PREVIEW project (Session pooler)
#   PRODUCTION_PROJECT_REF  ref of the REAL project (20 lowercase letters) — required
#   PROD_DB_URL             = secret SUPABASE_DB_URL (backup.yml)      } at least one of the two is
#   PROD_API_URL            = secret SUPABASE_URL    (keep-alive.yml)  } required, to cross-check
#
# Refuses when:
#   1. PRODUCTION_PROJECT_REF is missing or not 20 lowercase letters;
#   2. the preview ref cannot be read from PREVIEW_DB_URL (not exactly a Supabase direct/pooler
#      URL — see DB_URL_RE — or two different refs inside it);
#   3. the preview ref equals PRODUCTION_PROJECT_REF, or PREVIEW_DB_URL contains it anywhere;
#   4. neither SUPABASE_DB_URL nor SUPABASE_URL is set (and readable) to cross-check the production ref;
#   5. SUPABASE_DB_URL / SUPABASE_URL name a project other than PRODUCTION_PROJECT_REF
#      (the variable is wrong, so it cannot be trusted);
#   6. PREVIEW_DB_URL is byte-for-byte SUPABASE_DB_URL (compared as sha256 hashes),
#      or names the same project as SUPABASE_DB_URL / SUPABASE_URL.
# The same rules exist in scripts/preview-db/lib.mjs (Node side); keep them in step.
set -uo pipefail
set +x

mode="${1:-}"
if [ "$mode" != "push" ] && [ "$mode" != "reset" ]; then
  echo "::error title=Preview DB guard::Cách dùng: guard.sh push|reset"
  exit 1
fi

refuse() {
  echo "::error title=Preview DB guard — DỪNG::$1"
  exit 1
}

# Prints the project ref of a Supabase Postgres URL, or nothing. Never prints the password.
# Only the exact shape Supabase's Connect button gives is accepted:
#   postgres[ql]://postgres[.<ref>][:<password>]@<one host>[:<port>][/<db>][?sslmode=<mode>]
# so libpq / pgx cannot be sent elsewhere by something this parser does not see: a second '@'
# (libpq splits at the first one), several hosts (h1,h2), %-encoded hosts, IP literals, or
# query parameters such as host= / hostaddr= / user= / service= that override the host.
DB_URL_RE='^postgres(ql)?://(postgres(\.[a-z]{20})?)(:[^@/?#[:space:]]*)?@([A-Za-z0-9.-]+)(:[0-9]{1,5})?(/[A-Za-z0-9_]*)?(\?sslmode=[a-z-]+)?$'
ref_from_db_url() {
  local url="$1" host user_ref="" direct_ref=""
  [[ "$url" =~ $DB_URL_RE ]] || return 0
  user_ref="${BASH_REMATCH[3]#.}"
  host="$(printf '%s' "${BASH_REMATCH[5]}" | tr '[:upper:]' '[:lower:]')"
  if [[ "$host" =~ ^db\.([a-z]{20})\.supabase\.co$ ]]; then
    direct_ref="${BASH_REMATCH[1]}"
    if [ -n "$user_ref" ] && [ "$user_ref" != "$direct_ref" ]; then return 0; fi
    printf '%s' "$direct_ref"
  elif [[ "$host" =~ ^[a-z0-9-]+\.pooler\.supabase\.com$ ]]; then
    printf '%s' "$user_ref"
  fi
}

ref_from_api_url() {
  if [[ "${1:-}" =~ ^https://([a-z]{20})\.supabase\.co/?$ ]]; then printf '%s' "${BASH_REMATCH[1]}"; fi
}

sha() { printf '%s' "$1" | sha256sum | cut -d' ' -f1; }

preview_url="${PREVIEW_DB_URL:-}"
prod_ref="${PRODUCTION_PROJECT_REF:-}"
prod_db_url="${PROD_DB_URL:-}"
prod_api_url="${PROD_API_URL:-}"

if [ -z "$preview_url" ]; then
  if [ "$mode" = "push" ]; then
    echo "::notice title=Preview DB::Chưa có secret PREVIEW_DB_URL (docs/SETUP.md mục H) — bỏ qua, không làm gì."
    exit 10
  fi
  refuse "Chưa có secret PREVIEW_DB_URL."
fi

# 1
[[ "$prod_ref" =~ ^[a-z]{20}$ ]] || refuse "Biến PRODUCTION_PROJECT_REF chưa đặt hoặc sai dạng (20 chữ thường, xem SETUP mục H)."
# 2
preview_ref="$(ref_from_db_url "$preview_url")"
[ -n "$preview_ref" ] || refuse "Không đọc được mã project từ PREVIEW_DB_URL (phải là chuỗi kết nối Supabase, nút Connect › Session pooler)."
# Hide both refs from every later log line of this job.
echo "::add-mask::${preview_ref}"
echo "::add-mask::${prod_ref}"
# 3
[ "$preview_ref" != "$prod_ref" ] || refuse "PREVIEW_DB_URL trỏ vào project THẬT."
lower_url="$(printf '%s' "$preview_url" | tr '[:upper:]' '[:lower:]')"
[[ "$lower_url" != *"$prod_ref"* ]] || refuse "PREVIEW_DB_URL chứa mã project THẬT."
# 4–6
sources=0
if [ -n "$prod_db_url" ]; then
  [ "$(sha "$preview_url")" != "$(sha "$prod_db_url")" ] || refuse "PREVIEW_DB_URL giống hệt SUPABASE_DB_URL (database THẬT)."
  r="$(ref_from_db_url "$prod_db_url")"
  if [ -n "$r" ]; then
    sources=$((sources + 1))
    [ "$r" = "$prod_ref" ] || refuse "SUPABASE_DB_URL và PRODUCTION_PROJECT_REF chỉ 2 project khác nhau: kiểm tra lại PRODUCTION_PROJECT_REF."
    [ "$r" != "$preview_ref" ] || refuse "PREVIEW_DB_URL cùng project với SUPABASE_DB_URL (database THẬT)."
  fi
fi
if [ -n "$prod_api_url" ]; then
  r="$(ref_from_api_url "$prod_api_url")"
  if [ -n "$r" ]; then
    sources=$((sources + 1))
    [ "$r" = "$prod_ref" ] || refuse "SUPABASE_URL và PRODUCTION_PROJECT_REF chỉ 2 project khác nhau: kiểm tra lại PRODUCTION_PROJECT_REF."
    [ "$r" != "$preview_ref" ] || refuse "PREVIEW_DB_URL cùng project với SUPABASE_URL (project THẬT)."
  fi
fi
[ "$sources" -ge 1 ] || refuse "Cần secret SUPABASE_DB_URL hoặc SUPABASE_URL (của project thật) để đối chiếu — SETUP A9."

echo "Kiểm tra an toàn: OK — PREVIEW_DB_URL là một project khác project thật (${mode})."
exit 0
