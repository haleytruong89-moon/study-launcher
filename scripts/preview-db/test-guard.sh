#!/usr/bin/env bash
# Unit tests for scripts/preview-db/guard.sh with FAKE values only (no network, no database).
# Run: bash scripts/preview-db/test-guard.sh   (CI runs it in the "database" job).
set -uo pipefail
cd "$(dirname "$0")"

PROD=prodrefprodrefprodre   # fake 20-letter refs
PREV=previewrefpreviewref
OTHER=otherrefotherrefothe
PW='S3cret%40pass-word'
pooler() { printf 'postgresql://postgres.%s:%s@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres' "$1" "$PW"; }
direct() { printf 'postgresql://postgres:%s@db.%s.supabase.co:5432/postgres' "$PW" "$1"; }

fails=0
# expect <exit code> <description> <mode> [VAR=value ...]
expect() {
  local want="$1" what="$2" mode="$3"; shift 3
  local out code
  out="$(env -i PATH="$PATH" "$@" bash ./guard.sh "$mode" 2>&1)"
  code=$?
  if [ "$code" != "$want" ]; then
    echo "FAIL: $what (exit $code, want $want)"; echo "$out" | sed 's/^/    /'; fails=$((fails + 1)); return
  fi
  # Apart from the ::add-mask:: commands (hidden by GitHub), nothing secret may appear.
  local shown
  shown="$(printf '%s\n' "$out" | grep -v '^::add-mask::')"
  if [[ "$shown" == *"$PW"* || "$shown" == *"supabase.co"* || "$shown" == *"$PREV"* || "$shown" == *"$PROD"* || "$shown" == *"$OTHER"* ]]; then
    echo "FAIL: $what printed a secret"; fails=$((fails + 1)); return
  fi
  echo "ok   $what"
}

OKPROD=(PROD_DB_URL="$(pooler $PROD)" PROD_API_URL="https://$PROD.supabase.co")

expect 10 "push without PREVIEW_DB_URL skips cleanly"            push  PRODUCTION_PROJECT_REF=$PROD
expect 1  "reset without PREVIEW_DB_URL is refused"              reset PRODUCTION_PROJECT_REF=$PROD
expect 1  "unknown mode is refused"                              drop  PREVIEW_DB_URL="$(pooler $PREV)"
expect 0  "preview pooler URL + both prod sources -> ok"          push  PREVIEW_DB_URL="$(pooler $PREV)" PRODUCTION_PROJECT_REF=$PROD "${OKPROD[@]}"
expect 0  "preview direct URL -> ok (reset)"                      reset PREVIEW_DB_URL="$(direct $PREV)" PRODUCTION_PROJECT_REF=$PROD "${OKPROD[@]}"
expect 0  "only SUPABASE_URL as cross-check -> ok"                push  PREVIEW_DB_URL="$(pooler $PREV)" PRODUCTION_PROJECT_REF=$PROD PROD_API_URL="https://$PROD.supabase.co"
expect 1  "missing PRODUCTION_PROJECT_REF"                        push  PREVIEW_DB_URL="$(pooler $PREV)" "${OKPROD[@]}"
expect 1  "malformed PRODUCTION_PROJECT_REF"                      push  PREVIEW_DB_URL="$(pooler $PREV)" PRODUCTION_PROJECT_REF=PROD-1 "${OKPROD[@]}"
expect 1  "PREVIEW_DB_URL is the production pooler URL"           reset PREVIEW_DB_URL="$(pooler $PROD)" PRODUCTION_PROJECT_REF=$PROD "${OKPROD[@]}"
expect 1  "PREVIEW_DB_URL is the production direct URL"           reset PREVIEW_DB_URL="$(direct $PROD)" PRODUCTION_PROJECT_REF=$PROD "${OKPROD[@]}"
expect 1  "production ref hidden in the password"                 push  PREVIEW_DB_URL="postgresql://postgres.$PREV:x${PROD}x@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" PRODUCTION_PROJECT_REF=$PROD "${OKPROD[@]}"
expect 1  "not a Supabase host (localhost)"                       push  PREVIEW_DB_URL="postgresql://postgres.$PREV:pw@localhost:5432/postgres" PRODUCTION_PROJECT_REF=$PROD "${OKPROD[@]}"
expect 1  "not a postgres URL"                                    push  PREVIEW_DB_URL="https://$PREV.supabase.co" PRODUCTION_PROJECT_REF=$PROD "${OKPROD[@]}"
expect 1  "pooler URL without postgres.<ref> user"                push  PREVIEW_DB_URL="postgresql://postgres:pw@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" PRODUCTION_PROJECT_REF=$PROD "${OKPROD[@]}"
expect 1  "direct host and user name two different refs"         push  PREVIEW_DB_URL="postgresql://postgres.$OTHER:pw@db.$PREV.supabase.co:5432/postgres" PRODUCTION_PROJECT_REF=$PROD "${OKPROD[@]}"
expect 1  "no production URL to cross-check"                      push  PREVIEW_DB_URL="$(pooler $PREV)" PRODUCTION_PROJECT_REF=$PROD
expect 1  "unreadable SUPABASE_DB_URL is not a cross-check"       push  PREVIEW_DB_URL="$(pooler $PREV)" PRODUCTION_PROJECT_REF=$PROD PROD_DB_URL="postgres://weird"
expect 1  "wrong PRODUCTION_PROJECT_REF vs SUPABASE_DB_URL"       push  PREVIEW_DB_URL="$(pooler $PREV)" PRODUCTION_PROJECT_REF=$OTHER PROD_DB_URL="$(pooler $PROD)"
expect 1  "wrong PRODUCTION_PROJECT_REF vs SUPABASE_URL"          push  PREVIEW_DB_URL="$(pooler $PREV)" PRODUCTION_PROJECT_REF=$OTHER PROD_API_URL="https://$PROD.supabase.co"
expect 1  "wrong ref var AND preview = SUPABASE_DB_URL (hash)"    reset PREVIEW_DB_URL="$(pooler $PROD)" PRODUCTION_PROJECT_REF=$OTHER PROD_DB_URL="$(pooler $PROD)"
expect 1  "PREVIEW_DB_URL == SUPABASE_DB_URL (hash match)"        reset PREVIEW_DB_URL="$(pooler $PREV)" PRODUCTION_PROJECT_REF=$PROD PROD_DB_URL="$(pooler $PREV)"
expect 1  "SUPABASE_URL names the preview project"                reset PREVIEW_DB_URL="$(direct $PREV)" PRODUCTION_PROJECT_REF=$PROD PROD_API_URL="https://$PREV.supabase.co"
# Parser differentials: libpq / pgx would connect to the production host although the text
# never contains the production ref (ENC = %-encoded first letter). Only the exact Supabase shape passes.
ENC="%70${PROD:1}"
P=(PRODUCTION_PROJECT_REF=$PROD "${OKPROD[@]}")
expect 1  "second '@' (libpq splits at the first one)"            reset PREVIEW_DB_URL="postgresql://postgres:pw@db.$ENC.supabase.co:5432/x@db.$PREV.supabase.co:5432/postgres" "${P[@]}"
expect 1  "query host= overrides the host"                        reset PREVIEW_DB_URL="$(pooler $PREV)?host=db.$ENC.supabase.co&user=postgres" "${P[@]}"
expect 1  "query hostaddr= overrides the address"                 reset PREVIEW_DB_URL="$(direct $PREV)?hostaddr=2406:da18::1" "${P[@]}"
expect 1  "several hosts (fallback to the second)"                reset PREVIEW_DB_URL="postgresql://postgres:pw@db.$PREV.supabase.co:5432,db.$ENC.supabase.co:5432/postgres" "${P[@]}"
expect 1  "%-encoded host"                                        reset PREVIEW_DB_URL="postgresql://postgres:pw@db.%70$PREV.supabase.co:5432/postgres" "${P[@]}"
expect 1  "IPv6 literal host"                                     reset PREVIEW_DB_URL="postgresql://postgres:pw@[2406:da18::1]:5432/postgres" "${P[@]}"
expect 1  "unexpected user name"                                  reset PREVIEW_DB_URL="postgresql://admin.$PREV:pw@aws-0-x.pooler.supabase.com:5432/postgres" "${P[@]}"
expect 0  "?sslmode=require is fine"                              reset PREVIEW_DB_URL="$(direct $PREV)?sslmode=require" "${P[@]}"
expect 0  "uppercase host is fine"                                reset PREVIEW_DB_URL="postgresql://postgres:$PW@DB.$PREV.SUPABASE.CO:5432/postgres" "${P[@]}"
expect 1  "uppercase production host is refused"                  reset PREVIEW_DB_URL="postgresql://postgres:$PW@DB.${PROD^^}.SUPABASE.CO:5432/postgres" "${P[@]}"

if [ "$fails" -ne 0 ]; then echo "$fails guard test(s) FAILED" >&2; exit 1; fi
echo "guard.sh: all tests passed"
