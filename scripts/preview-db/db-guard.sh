#!/usr/bin/env bash
# Second safety gate, run after guard.sh: looks INSIDE the database the URL points to, in a
# READ ONLY transaction, and refuses if it holds any login that is not a test account.
# The real project always holds the parents' real e-mail addresses; the preview project only
# holds @example.com (test parent) and @study-launcher.local (children) accounts.
# Same domain list as lib.mjs TEST_EMAIL_DOMAINS and reset.sql: keep the three in step.
#
#   PREVIEW_DB_URL=... bash scripts/preview-db/db-guard.sh
#
# Exit 0 = only test accounts (or none) · 1 = refused / could not check (fail closed).
set -uo pipefail
set +x

if [ -z "${PREVIEW_DB_URL:-}" ]; then
  echo "::error title=Preview DB guard — DỪNG::Thiếu PREVIEW_DB_URL."
  exit 1
fi

out="$(psql "$PREVIEW_DB_URL" -X -q -At -v ON_ERROR_STOP=1 2>/dev/null <<'SQL'
begin transaction read only;
select count(*) from auth.users
 where email is null
    or lower(split_part(email, '@', 2)) not in ('example.com', 'study-launcher.local');
rollback;
SQL
)"
status=$?

if [ "$status" -ne 0 ] || ! [[ "$out" =~ ^[0-9]+$ ]]; then
  echo "::error title=Preview DB guard — DỪNG::Không đọc được database preview để kiểm tra (sai mật khẩu, project đang ngủ, hoặc chuỗi kết nối sai)."
  exit 1
fi
if [ "$out" -ne 0 ]; then
  echo "::error title=Preview DB guard — DỪNG::Database này có ${out} tài khoản không phải tài khoản thử (email thật). Có thể đây là database THẬT: không làm gì. Nếu đúng là preview, xóa các tài khoản đó trong Supabase preview › Authentication › Users rồi chạy lại (SETUP mục H)."
  exit 1
fi
echo "Kiểm tra bên trong database: chỉ có tài khoản thử — OK."
