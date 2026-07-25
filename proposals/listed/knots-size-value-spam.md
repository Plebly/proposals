---
id: PLEBLY-KNOTS-SIZE-VALUE-SPAM
title: "Knots PR: reject high size-to-value relay spam"
status: listed
target_sats: 1500000
milestones:
  - id: policy-pr
    deliverable: "Open pull request against bitcoinknots/bitcoin adding a relay/mining policy that rejects transactions whose weight (or vsize) exceeds a configurable ratio to total output value"
    verification: "PR URL exists; introduces a documented knob (e.g. -maxsizevalueratio=N bytes-per-satoshi or equivalent); unit/functional tests cover accept below threshold and reject above; help text / release note mention the flag"
    out_of_scope: "Merge into Knots; changing consensus rules; miner-template mandates"
    allocation_sats: 1000000
    deadline: "2026-10-15"
  - id: signet-repro
    deliverable: "Signet repro script or doc: one high size/low-value tx rejected, one ordinary payment accepted, under the new default or a documented test setting"
    verification: "Two independent reviewers run the steps and match accept/reject outcomes"
    out_of_scope: "Mainnet default-politics campaigning"
    allocation_sats: 500000
    deadline: "2026-11-01"
depends_on: []
related_work:
  - label: "Bitcoin Knots"
    url: "https://github.com/bitcoinknots/bitcoin"
  - label: "Knots policy.cpp (current standardness checks)"
    url: "https://github.com/bitcoinknots/bitcoin/blob/master/src/policy/policy.cpp"
escrow_address: null
escrow_index: null
submission_fee_txid: "0000000000000000000000000000000000000000000000000000000000000000"
proposer:
  username: secsovereign
  github: null
  nostr: null
created_at: "2026-07-25T00:00:00Z"
---

# Knots PR: reject high size-to-value relay spam

## Problem

Bitcoin Knots already has strong relay knobs for datacarrier weight, tokens (`-rejecttokens`), parasites (`-rejectparasites`), dust, and witness/stack limits. What it does **not** have is a policy that rejects transactions simply because they are enormous relative to the sats they move — the classic “megabytes of weight, dust-worth of value” spam shape.

Operators who want that heuristic need an upstream Knots PR with a clear, tunable threshold — not a one-off local patch.

## Deliverable

A pull request to `bitcoinknots/bitcoin` that:

1. Adds a relay/mining standardness check comparing transaction weight (or vsize) to total output value (`GetValueOut()` or equivalent).
2. Exposes a config/CLI knob so operators can set or disable the ratio (safe default documented in the PR).
3. Includes tests for borderline accept/reject cases and operator-facing help/release notes.

Verified against current Knots `src/policy/policy.cpp` / `src/init.cpp`: no existing size-to-value (bytes-per-sat) reject path.

## Verification

- PR is open on `bitcoinknots/bitcoin` with the knob, tests, and docs above.
- Signet repro shows one oversized low-value tx rejected and one normal payment accepted.
- Two reviewers independently get the same results.

## Out of scope

- Consensus changes
- Hard-coding an untunable default with no disable path
- Porting unrelated heuristics (inscription envelopes, token protocols, dust rules — Knots already covers those)

## Notes

`submission_fee_txid` is the signet seed placeholder (all zeros) until a real 10k fee payment is attached. Escrow address allocated when funded.
