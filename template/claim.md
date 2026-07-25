# Claim a project (manual / git path)

Site claim via plebly.fund opens a PR for you. Direct PRs remain valid.

## Front matter fields (on the proposal file)

At **PR open** (site or git):

```yaml
status: claimed
claimer: your-username-or-github
claim_opened_at: "2026-07-25T00:00:00Z"
claimed_at: null
payout_address: "bc1…"
claim_bond_txid: "<64-hex>"
```

After **merge**, Worker sets `claimed_at` from the claim PR `merged_at` (Q7). Do not invent `claimed_at` at open — the 90-day window starts at merge.

## Steps

1. Confirm escrow confirmed balance ≥ claim floor (see PARAMETERS.md).
2. Pay exact claim bond to the fee address; include `claim_bond_txid` (CI verifies).
3. Proposal `status` must be `listed`, `funding`, or `claimable` (not already claimed).
4. Open a PR that sets the fields above and preferably moves the file to `proposals/claimed/`.
5. Exclusive claim and the 90-day window start when the PR **merges**.
6. Concurrent claim PRs: earliest merge wins; others should be closed.
7. Bond is spent at verify — forfeited if the PR never merges (see TESTING.md).
