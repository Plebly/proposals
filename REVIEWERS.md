# Reviewers

Anyone who completes at least one bounty becomes a reviewer. Bootstrap reviewers are named before launch.

**Runtime source of truth:** Cloudflare KV (`reviewer:{userId}`, `reviewer:index`), seeded via `POST /reviewers/bootstrap` and updated automatically on claim `completed`. This file is the public mirror / bootstrap naming surface.

## Quorum

```
roster = |active reviewers|
need_yes = ceil(2/3 * roster)
pass iff yes >= need_yes AND (yes + no) >= 5 AND yes > 0
```

Non-responses count as abstentions. Abstentions never satisfy `need_yes`. Bootstrap roster of 5 requires 4 yes votes and five non-abstaining votes.

**Conflicts / abuse:** The fulfiller is excluded from voting and from the roster for their own proposal’s decision. Bootstrap seats cannot be removed by funder vote. Removal eligibility requires ≥10,000 sats confirmed in the prior 12 months (dust sybil resistance).

## Bootstrap roster (TBD — not yet seeded)

Five named seats until **ten** platform completions; bootstrap seats retained permanently afterward.

**Status:** KV roster is empty until ops runs [`scripts/bootstrap-reviewers.sh`](scripts/bootstrap-reviewers.sh) with exactly five final user ids (`HOOK_SECRET` required). Seats are permanent — do not seed until the five are chosen. Procedure: [`docs/mainnet-launch-ops.md`](docs/mainnet-launch-ops.md) §C. Then fill this table and merge.

| Identity | Proof / track record | Seated |
|----------|----------------------|--------|
| TBD | | |
| TBD | | |
| TBD | | |
| TBD | | |
| TBD | | |

## Earned reviewers

| Identity | Proposal | Added |
|----------|----------|-------|

(Worker adds seats in KV on `completed`; mirror PRs optional.)
