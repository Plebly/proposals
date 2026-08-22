# Keyholder stall runbook (Q21)

When reviewers approve a release but keyholders will not sign a Worker-bound package:

## Timeline

Day 0 is the first `disburse_ready` for that package — not reviewer approval and not a monthly fee freeze.

| Day | Action |
|-----|--------|
| 0 | `disburse_ready`. Public log: proposal id, **seat numbers** that have not signed (not names). |
| 7 | Public incident note if still unsigned. |
| 14 | Escalate; site shows `release_blocked_reason` banner via `/escrow/stall`. Optional `seats: [1,4]` in the hook body. |

Replacement: 30-day descriptor notice, new 3-of-5, **same package waits**. No extra donor vote. Keyholders do not re-judge quality.

## Worker hook

```bash
curl -X POST "$WORKERS_API/escrow/stall" \
  -H "X-Plebly-Hook-Secret: $HOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"proposal_id":"…","reason":"Keyholder stall — seats 1 and 4 unsigned — see public log YYYY-MM-DD","seats":[1,4]}'
```

Clear by deleting KV `release_blocked:{proposal_id}` or setting a new stall with empty reason after resolution (ops).

## Residual trust

v1 has no on-chain timelock forcing 3-of-5. Documented in About / PARAMETERS / `docs/dispute-resolution.md`. Escrow mechanism upgrades require ≥30-day notice. Twin/Miniscript paths are not ratified.
