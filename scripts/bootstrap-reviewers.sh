#!/usr/bin/env bash
# Seed 3–5 bootstrap reviewer seats via the Worker hook.
# Usage:
#   HOOK_SECRET=… ./scripts/bootstrap-reviewers.sh github:a github:b github:c
#   HOOK_SECRET=… ./scripts/bootstrap-reviewers.sh github:a github:b github:c github:d github:e
# A later run may add seats up to five if it includes every id already seated.
# Optional:
#   API=https://plebly-api.securesovereigns.workers.dev
set -euo pipefail

API="${API:-https://plebly-api.securesovereigns.workers.dev}"
API="${API%/}"

if [[ -z "${HOOK_SECRET:-}" ]]; then
  echo "HOOK_SECRET is required (Worker secret; never commit it)." >&2
  exit 1
fi

if [[ "$#" -lt 3 || "$#" -gt 5 ]]; then
  echo "bootstrap requires 3–5 user ids (got $#)." >&2
  echo "example: $0 github:alice github:bob github:carol" >&2
  exit 1
fi

body=$(python3 - "$@" <<'PY'
import json, sys
print(json.dumps({"user_ids": sys.argv[1:]}))
PY
)

echo "POST $API/reviewers/bootstrap"
res=$(curl -sS -w '\n%{http_code}' \
  -X POST "$API/reviewers/bootstrap" \
  -H "Content-Type: application/json" \
  -H "X-Plebly-Hook-Secret: $HOOK_SECRET" \
  -d "$body")
code=$(printf '%s' "$res" | tail -n1)
json=$(printf '%s' "$res" | sed '$d')
echo "$json" | python3 -m json.tool 2>/dev/null || echo "$json"
if [[ "$code" != "200" ]]; then
  echo "bootstrap failed HTTP $code" >&2
  exit 1
fi

echo "Verify: curl -sS $API/reviewers | python3 -m json.tool"
curl -sS "$API/reviewers" | python3 -m json.tool
echo
echo "Next: mirror the identities into REVIEWERS.md and open a PR."
