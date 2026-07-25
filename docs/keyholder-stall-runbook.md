# Keyholder stall runbook (Q21)

When reviewers approve a release but keyholders will not sign:

## Timeline

| Day | Action |
|-----|--------|
| 0 | Public log entry: who blocked, proposal id, reason (if given) |
| 7 | Public incident note if still unsigned |
| 14 | Escalate to incident process; site shows `release_blocked_reason` banner |

## Worker hook

```bash
curl -X POST "$WORKERS_API/escrow/stall" \
  -H "X-Plebly-Hook-Secret: $HOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"proposal_id":"…","reason":"Keyholder stall — see public log YYYY-MM-DD"}'
```

Clear by deleting KV `release_blocked:{proposal_id}` or setting a new stall with empty reason after resolution (ops).

## Residual trust

v1 has no on-chain timelock forcing 3-of-5. Documented in About / PARAMETERS. Escrow mechanism upgrades require ≥30-day notice.
