---
id: PLEBLY-KNOTS-SPAM-HEURISTICS
title: "Knots PR: Commons-style spam heuristic presets"
status: listed
target_sats: 2500000
milestones:
  - id: survey-gap
    deliverable: "Public gap note comparing Bitcoin Commons spam_filter presets to current Knots policy knobs"
    verification: "Markdown note lists each Commons category (inscriptions, BRC-20, large witness, size/value ratio, many-small-outputs) and the closest Knots flag or 'missing'"
    out_of_scope: "Implementing policy changes in this milestone"
    allocation_sats: 500000
    deadline: "2026-09-01"
  - id: knots-pr
    deliverable: "Opened pull request against bitcoinknots/bitcoin adding operator-selectable spam heuristic presets"
    verification: "PR URL exists; includes config flags or preset enum, unit/functional tests, and release-notes/help text"
    out_of_scope: "Merge into Knots master or backport to Bitcoin Core"
    allocation_sats: 1500000
    deadline: "2026-10-15"
  - id: docs-repro
    deliverable: "Operator doc + signet repro showing StrictInscriptions-style envelope detection without misclassifying ordinary multisig/Miniscript spends"
    verification: "Doc lists commands, sample txs, and expected accept/reject outcomes; two reviewers get the same results"
    out_of_scope: "Mainnet default-policy politics or mining-template mandates"
    allocation_sats: 500000
    deadline: "2026-11-01"
depends_on: []
related_work:
  - label: "Bitcoin Commons spam filter (blvm-protocol)"
    url: "https://github.com/bitcoin-commons/blvm-protocol"
  - label: "Bitcoin Knots"
    url: "https://github.com/bitcoinknots/bitcoin"
  - label: "Core datacarrier discussion"
    url: "https://github.com/bitcoin/bitcoin/pull/32359"
escrow_address: null
escrow_index: null
submission_fee_txid: "0000000000000000000000000000000000000000000000000000000000000000"
proposer:
  username: secsovereign
  github: null
  nostr: null
created_at: "2026-07-25T00:00:00Z"
---

# Knots PR: Commons-style spam heuristic presets

## Problem

Bitcoin Commons already ships a layered spam filter for sync/UTXO work: inscription/envelope detection, BRC-20 patterns, large-witness thresholds, size-to-value ratio, and many-small-outputs — with presets (`Conservative`, `Moderate`, `Aggressive`, `StrictInscriptions`) so operators can choose false-positive tolerance.

Bitcoin Knots has strong policy knobs today, but not this Commons-style **preset bundle** that keeps envelope/pattern detection separate from blunt large-witness cuts (the `StrictInscriptions` lesson: avoid treating Miniscript/vaults as inscriptions).

Relay operators who want Commons-grade heuristics on a Knots node need a concrete upstream PR, not a one-off local patch.

## Deliverable

1. Gap note: Commons `spam_filter` categories vs current Knots flags.
2. A Knots pull request that adds operator-selectable presets (or an equivalent `-spamfilterpreset=` / documented option set) covering at least:
   - inscription/envelope pattern detection
   - BRC-20-style patterns
   - large-witness threshold (separate category)
   - high size-to-value ratio
   - many small outputs
3. Signet repro + operator docs proving StrictInscriptions-style behavior.

## Verification

- Gap note is public and maps each Commons category to Knots (or marks missing).
- PR is open on `bitcoinknots/bitcoin` with tests and help/release notes.
- Two independent reviewers can run the signet repro and match accept/reject outcomes.

## Out of scope

- Changing Bitcoin consensus rules
- Forcing miner template policy network-wide
- Merging the PR (opening a mergeable PR is enough)
- Porting UTXO-commitment / filtered-block sync from Commons (different layer)

## Notes

Inspired by Bitcoin Commons `blvm-protocol` spam filter presets — especially `StrictInscriptions` (`ordinals_strict_mode`: envelope/pattern only; large witness classified separately). Escrow address will be allocated when this moves from listed demo to funded escrow.
