# Reviewers

Anyone who completes at least one bounty becomes a reviewer. Bootstrap reviewers are named before launch.

**Runtime source of truth:** Cloudflare KV (`reviewer:{userId}`, `reviewer:index`), seeded via `POST /reviewers/bootstrap` and updated automatically on claim `completed`. This file is the public mirror / bootstrap naming surface.

## Quorum

```
roster = |active reviewers|
need_yes = ceil(2/3 * roster)
participate = min(5, max(3, roster))
pass iff yes >= need_yes AND (yes + no) >= participate AND yes > 0
```

Non-responses count as abstentions. Abstentions never satisfy `need_yes`. A roster of 3 requires 2 yes and all three voting. A roster of 5 still requires 4 yes and all five voting.

Why the floor is 3 (target 5), and why they are not keyholders: [`docs/why-five-reviewers.md`](../docs/why-five-reviewers.md).

**Conflicts / abuse:** The fulfiller is excluded from voting and from the roster for their own proposal’s decision. Bootstrap seats cannot be removed by funder vote. Removal eligibility requires ≥10,000 sats confirmed in the prior 12 months (dust sybil resistance).

## Bootstrap roster (TBD — not yet seeded)

Three to five named seats until **ten** platform completions; bootstrap seats retained permanently afterward. Seed at least three; a later hook call may add seats up to five if it includes every id already seated.

**Status:** KV roster is empty on purpose. Launch does not wait on this. Seed before the first flagged review via [`scripts/bootstrap-reviewers.sh`](scripts/bootstrap-reviewers.sh) with 3–5 final user ids (`HOOK_SECRET` required). Seats are permanent — do not seed throwaways or a single operator. Procedure: [`docs/mainnet-launch-ops.md`](docs/mainnet-launch-ops.md) §C. Then fill this table and merge.

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
