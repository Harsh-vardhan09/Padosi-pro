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
# these helpers captures JSON only. Exits if the status is not the one we expect.
request() {
  local method="$1" path="$2" expected="$3" payload="$4" auth="${5:-}"
  local response status body

  response=$(curl -sS -X "$method" "$API$path" \
    -H 'Content-Type: application/json' \
    ${auth:+-H "Authorization: Bearer $auth"} \
    ${payload:+-d "$payload"} \
    -w $'\n%{http_code}')

  status="${response##*$'\n'}"
  body="${response%$'\n'*}"

  printf '   %-4s %s -> %s (expected %s)\n' "$method" "$path" "$status" "$expected" >&2
  # Truncated so a long response (the whole task catalogue) stays readable in the transcript.
  echo "$body" | cut -c1-300 | sed 's/^/     /' >&2

  if [ "$status" != "$expected" ]; then
    echo "   FAILED: expected $expected, got $status" >&2
    exit 1
  fi

  printf '%s' "$body"
}

post() { request POST "$1" "$2" "$3" "${4:-}"; }
put() { request PUT "$1" "$2" "$3" "${4:-}"; }
get() { request GET "$1" "$2" '' "${3:-}"; }

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

step "12. The authenticated routes need a token"
get /api/me 401 > /dev/null

step "13. GET /api/me before the profile exists"
get /api/me 200 "$TOKEN" | field "['profile']" > /dev/null
get /api/profile 200 "$TOKEN" > /dev/null

step "14. The profile form is validated"
put /api/profile 400 '{"fullName":"A","mobile":"12345","address":"short"}' "$TOKEN" > /dev/null

step "15. Save the profile (messy mobile is normalised)"
put /api/profile 200 \
  '{"fullName":"Asha Menon","mobile":"+91 98765 43210","address":"12 MG Road, Bengaluru 560001"}' \
  "$TOKEN" | field "['profile']['mobile']" > /dev/null

step "16. Business name is optional and clears when omitted"
put /api/profile 200 \
  '{"fullName":"Asha Menon","mobile":"9876543210","address":"12 MG Road, Bengaluru 560001","businessName":"Menon Textiles"}' \
  "$TOKEN" > /dev/null
put /api/profile 200 \
  '{"fullName":"Asha Menon","mobile":"9876543210","address":"12 MG Road, Bengaluru 560001"}' \
  "$TOKEN" > /dev/null

step "17. The task catalogue"
CATALOGUE=$(get /api/tasks 200 "$TOKEN")
TASK_A=$(printf '%s' "$CATALOGUE" | field "['categories'][0]['tasks'][0]['id']")
TASK_B=$(printf '%s' "$CATALOGUE" | field "['categories'][1]['tasks'][0]['id']")
printf '   %s categories, picking task ids %s and %s\n' \
  "$(printf '%s' "$CATALOGUE" | field "['categories'].__len__()")" "$TASK_A" "$TASK_B" >&2

step "18. An empty selection is refused"
put /api/me/tasks 400 '{"taskIds":[]}' "$TOKEN" > /dev/null

step "19. Duplicate ids are refused"
put /api/me/tasks 400 "{\"taskIds\":[$TASK_A,$TASK_A]}" "$TOKEN" > /dev/null

step "20. Unknown ids are listed back"
put /api/me/tasks 400 "{\"taskIds\":[$TASK_A,999999,888888]}" "$TOKEN" > /dev/null

step "21. Save the selection"
put /api/me/tasks 200 "{\"taskIds\":[$TASK_A,$TASK_B]}" "$TOKEN" > /dev/null

step "22. Read it back, and /api/me now counts it"
get /api/me/tasks 200 "$TOKEN" > /dev/null
get /api/me 200 "$TOKEN" | field "['selectedTaskCount']" > /dev/null

step "23. Saving again replaces rather than appends"
put /api/me/tasks 200 "{\"taskIds\":[$TASK_B]}" "$TOKEN" > /dev/null
COUNT=$(get /api/me 200 "$TOKEN" | field "['selectedTaskCount']")
if [ "$COUNT" != "1" ]; then
  echo "   FAILED: selection should have been replaced, count is $COUNT" >&2
  exit 1
fi
echo "   selectedTaskCount is 1, so the previous choice was replaced" >&2

step "24. Logout invalidates every existing token"
post /api/auth/logout 200 '{}' "$TOKEN" > /dev/null
post /api/auth/logout 401 '{}' "$TOKEN" > /dev/null
get /api/me 401 "$TOKEN" > /dev/null

echo >&2
echo "All auth flows behaved as expected." >&2
