#!/usr/bin/env bash
# Walks the whole auth flow against a running API: register -> verify -> login -> logout.
#
#   ./scripts/smoke-auth.sh                     # unique throwaway email, code read from the logs
#   ./scripts/smoke-auth.sh you@example.com     # a real inbox (needs MAIL_DRIVER=emailjs)
#   API=http://localhost:4000 ./scripts/smoke-auth.sh
#   CODE=123456 ./scripts/smoke-auth.sh you@example.com
#
# With MAIL_DRIVER=console the script reads the code from `docker compose logs api`, and asks you to
# paste it when the API is not running under Compose.

set -euo pipefail

API="${API:-http://localhost:4000}"
EMAIL="${1:-smoke+$(date +%s)@example.com}"
PASSWORD="${PASSWORD:-Passw0rd123}"

step() { echo >&2; echo "== $1" >&2; }

# Prints the response body on stdout and the progress on stderr, so a command substitution around
# this function captures JSON only. Exits if the status is not the one we expect.
post() {
  local path="$1" expected="$2" payload="$3" auth="${4:-}"
  local response status body

  response=$(curl -sS -X POST "$API$path" \
    -H 'Content-Type: application/json' \
    ${auth:+-H "Authorization: Bearer $auth"} \
    -d "$payload" \
    -w $'\n%{http_code}')

  status="${response##*$'\n'}"
  body="${response%$'\n'*}"

  echo "   POST $path -> $status (expected $expected)" >&2
  echo "$body" | sed 's/^/     /' >&2

  if [ "$status" != "$expected" ]; then
    echo "   FAILED: expected $expected, got $status" >&2
    exit 1
  fi

  printf '%s' "$body"
}

field() { python -c "import json,sys;print(json.load(sys.stdin)$1)"; }

step "0. Health"
curl -sS "$API/health" >&2
echo >&2

step "1. Register  ($EMAIL)"
post /api/auth/register 201 "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" > /dev/null

step "2. Validation is enforced"
post /api/auth/register 400 '{"email":"not-an-email","password":"short"}' > /dev/null

step "3. Read the OTP"
CODE="${CODE:-}"
if [ -z "$CODE" ]; then
  CODE=$(docker compose logs api 2>/dev/null \
    | grep -F "[mail:console] OTP for $EMAIL" \
    | tail -1 | grep -oE '[0-9]{6}' | tail -1 || true)
fi
if [ -z "$CODE" ]; then
  read -r -p "   Paste the 6-digit code (check the API log or your inbox): " CODE
fi
echo "   code: $CODE" >&2

step "4. A wrong code reports how many attempts are left"
post /api/auth/verify-otp 400 "{\"email\":\"$EMAIL\",\"code\":\"000000\"}" > /dev/null

step "5. A resend inside the 30s cooldown is refused"
post /api/auth/resend-otp 429 "{\"email\":\"$EMAIL\"}" > /dev/null

step "6. Login before verifying is refused"
post /api/auth/login 403 "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" > /dev/null

step "7. Verify the OTP (auto-login)"
post /api/auth/verify-otp 200 "{\"email\":\"$EMAIL\",\"code\":\"$CODE\"}" | field "['token']" > /dev/null

step "8. The same code cannot be used twice"
post /api/auth/verify-otp 409 "{\"email\":\"$EMAIL\",\"code\":\"$CODE\"}" > /dev/null

step "9. Login"
TOKEN=$(post /api/auth/login 200 "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | field "['token']")

step "10. A wrong password is rejected"
post /api/auth/login 401 "{\"email\":\"$EMAIL\",\"password\":\"WrongPass123\"}" > /dev/null

step "11. An unknown email gives the identical error"
post /api/auth/login 401 '{"email":"nobody@example.com","password":"WrongPass123"}' > /dev/null

step "12. Logout invalidates every existing token"
post /api/auth/logout 200 '{}' "$TOKEN" > /dev/null
post /api/auth/logout 401 '{}' "$TOKEN" > /dev/null

echo >&2
echo "All auth flows behaved as expected." >&2
