---
id: PLEBLY-SIGNET-DEMO
title: "Signet smoke test bounty"
status: listed
target_sats: 100000
milestones:
  - id: smoke-list
    deliverable: "Proposal listed on plebly.fund with signet balance visible"
    verification: "Open the project page; confirmed escrow balance renders from signet mempool"
    out_of_scope: "Mainnet escrow or multisig release"
    allocation_sats: 50000
    deadline: "2026-08-15"
  - id: smoke-fund-claim
    deliverable: "Documented fund → claim-floor path on signet"
    verification: "Send signet sats to escrow; page balance updates; claim floor status is correct"
    out_of_scope: "Production keyholders, Lightning, or real deliverable review"
    allocation_sats: 50000
    deadline: "2026-09-15"
escrow_address: "tb1qacjkkdgkrm7fc50kws0740cdcnw78xynxgn8p5"
escrow_index: 0
submission_fee_txid: "0000000000000000000000000000000000000000000000000000000000000000"
proposer:
  username: secsovereign
  github: null
  nostr: null
created_at: "2026-07-24T00:00:00Z"
---

# Signet smoke test bounty

## Problem

Need a live signet proposal to exercise listing, balance display, and the claim floor path without mainnet risk.

## Deliverable

Replace this file's `escrow_address` with your signet `tb1…` address for real testing. The current address is a public signet wallet used only to verify balance display on plebly.fund.

## Verification

1. Open https://plebly.fund and see this proposal listed under **secsovereign**.
2. Send signet sats to the escrow address.
3. Balance on the proposal page increases (signet mempool).

## Out of scope

Mainnet escrow, multisig, guild review, or real deliverables.
