#!/usr/bin/env bash
# One-shot: activate the first two Worker keyholder identities.
# Does not publish the Sparrow descriptor or address map — do that in KEYHOLDERS.md.
# Usage:
#   HOOK_SECRET=… ./scripts/bootstrap-keyholders-genesis.sh \
#     github:alice AABBCCDD tpub... \
#     github:bob 11223344 tpub...
# Optional:
#   API=https://plebly-api.securesovereigns.workers.dev
set -euo pipefail

API="${API:-https://plebly-api.securesovereigns.workers.dev}"
API="${API%/}"

if [[ -z "${HOOK_SECRET:-}" ]]; then
  echo "HOOK_SECRET is required (Worker secret; never commit it)." >&2
  exit 1
fi

if [[ "$#" -ne 6 ]]; then
  echo "genesis needs two seats: user_id fingerprint xpub user_id fingerprint xpub (got $# args)." >&2
  echo "example: $0 github:alice AABBCCDD tpub... github:bob 11223344 tpub..." >&2
  exit 1
fi

body=$(USER_A="$1" FP_A="$2" XPUB_A="$3" USER_B="$4" FP_B="$5" XPUB_B="$6" python3 <<'PY'
import json, os, re, sys

def seat(user_id, fingerprint, xpub):
    uid = user_id.strip()
    if ":" not in uid:
        uid = f"github:{uid}"
    fp = fingerprint.strip().upper()
    if not re.fullmatch(r"[0-9A-F]{8}", fp):
        print(f"fingerprint must be 8 hex characters: {fingerprint}", file=sys.stderr)
        sys.exit(1)
    pub = xpub.strip()
    if not re.match(r"^(xpub|tpub)[1-9A-HJ-NP-Za-km-z]{20,}$", pub):
        print("invalid xpub/tpub", file=sys.stderr)
        sys.exit(1)
    github = uid.split(":", 1)[1] if uid.startswith("github:") else uid
    return {
        "user_id": uid,
        "github": github,
        "fingerprint": fp,
        "xpub": pub,
    }

print(json.dumps({
    "seats": [
        seat(os.environ["USER_A"], os.environ["FP_A"], os.environ["XPUB_A"]),
        seat(os.environ["USER_B"], os.environ["FP_B"], os.environ["XPUB_B"]),
    ]
}))
PY
)

echo "POST $API/keyholders/genesis"
res=$(curl -sS -w '\n%{http_code}' \
  -X POST "$API/keyholders/genesis" \
  -H "Content-Type: application/json" \
  -H "X-Plebly-Hook-Secret: $HOOK_SECRET" \
  -d "$body")
code=$(printf '%s' "$res" | tail -n1)
json=$(printf '%s' "$res" | sed '$d')
echo "$json" | python3 -m json.tool 2>/dev/null || echo "$json"
if [[ "$code" != "200" ]]; then
  echo "genesis failed HTTP $code" >&2
  exit 1
fi

echo "Verify: curl -sS $API/keyholders/public"
curl -sS "$API/keyholders/public" | python3 -m json.tool
echo
echo "Those two are active now. Seat 3+ apply or get invited, then the pair co-attests."
echo "Still publish the Sparrow descriptor + ESCROW_ADDRESS_MAP separately."
