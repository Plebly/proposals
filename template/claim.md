# Claim a project (manual / git path)

Site claim via plebly.fund opens a PR for you. Direct PRs remain valid.

## Front matter fields (on the proposal file)

At **PR open** (site or git):

```yaml
status: claimed
claimer: your-username-or-github
claimer_type: individual   # individual | org
claim_agent: null          # required when claimer_type is org
claim_mode: proposer_select  # or first_bonded (frozen at propose)
claim_window_days: 7
claim_award_reason: proposer_accept  # first_bonded | proposer_accept | auto_earliest_bonded
claim_collaborators: []
claim_opened_at: "2026-07-25T00:00:00Z"
claimed_at: null
payout_address: "bc1…"
claim_bond_txid: "<64-hex>"
```

After **merge**, Worker sets `claimed_at` from the claim PR `merged_at` (Q7). Do not invent `claimed_at` at open — the 90-day window starts at merge.

Site path: builders **apply with bond**; award is `first_bonded`, proposer accept, or auto earliest bonded after the select window + grace (Q9).

## Steps

1. Confirm escrow confirmed balance ≥ claim floor (see PARAMETERS.md).
2. Pay exact claim bond to the fee address; include `claim_bond_txid` (CI verifies).
3. Proposal `status` must be `listed`, `funding`, or `claimable` (not already claimed).
4. Prefer the site apply flow; direct PRs remain valid for the awarded claimer.
5. Exclusive claim and the 90-day window start when the claim PR **merges**.
6. Bond is spent at verify — refundable for non-selected applicants; locked for the winner.
