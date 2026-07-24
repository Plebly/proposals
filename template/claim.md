# Claim a project (manual / git path)

Site claim via plebly.fund opens a PR for you. Direct PRs remain valid.

## Front matter fields (on the proposal file)

```yaml
status: claimed
claimer: your-username-or-github
claimed_at: "2026-07-24T00:00:00Z"
payout_address: "bc1…"
```

## Steps

1. Confirm escrow confirmed balance ≥ claim floor (see PARAMETERS.md).
2. Proposal `status` must be `listed`, `funding`, or `claimable` (not already claimed).
3. Open a PR that sets the fields above and preferably moves the file to `proposals/claimed/`.
4. Exclusive claim and the 90-day window start when the PR **merges**.
5. Concurrent claim PRs: earliest merge wins; others should be closed.
