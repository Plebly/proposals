# Parameters

Fixed at first public submission. Changes require a public process and thirty-day notice.

Community parameter votes are not live. Any future ballot system is volume-gated and cannot change these parameters until its rules and activation process are published.

**Canonical machine source:** [`parameters.json`](./parameters.json). After editing it, run `npm run parameters:sync` to refresh this file and generated TypeScript in `workers` / `plebly.fund`.

<!-- parameters:generated:start -->

## Section VII (launch-locked)

| Parameter | Value |
|-----------|-------|
| Submission fee | 10,000 sats (exact, non-refundable) |
| Platform fee | 2.5% of escrow to Plebly at successful disbursement |
| Milestone threshold | 1,000,000 sats |
| Claim window | 90 days from claim acceptance |
| Claim extension | One 30-day extension via reviewer supermajority |
| Delivery window (direct proposals) | 90 days from escrow allocation |
| Proposal type default | `bounty` (missing field → bounty) |

### Claim floor by network

| Network | Claim floor | Notes |
|---------|-------------|-------|
| Signet | 10,000 sats | Temporary lower floor for faucet-friendly signet testing; restore toward mainnet value before launch. |
| Mainnet | 100,000 sats | Launch minimum |

Machine-readable source: [`parameters.json`](./parameters.json). Edit that file, then run `npm run parameters:sync`.

## Ratified (pre-launch process defaults)

| Parameter | Value |
|-----------|-------|
| Active funding window (Q5) | 180 days from escrow address allocation |
| Funding window extension (Q5) | One 90-day extension via reviewer vote |
| Idle claimable → contributor ballot (Q54) | 365 days with no claim → `abandoned_vote` |
| Redirect / underfunded ballot (Q18) | Options `extend` \| `refund` \| `redirect:<id>`; 1 claimed contributor identity = 1 vote; quorum = majority of distinct contributors (or all if &lt;3) |
| Badge: Notable Contributor | 21,000 sats (per proposal) |
| Badge: Major Contributor | 100,000 sats |
| Badge: Patron | 1,000,000 sats |
| Submission fee confirmations | 1 |
| Funding / badge / vote confirmations | 3 |
| Completion finality confirmations | 3 |
| Core annual gap | 2,100,000 sats |

Signet fee/bond receive (live): `tb1qhj27cegpek02g8g4peps0x7gqs0svvs888svyz` (Workers `TEST_SUBMISSION_FEE_ADDRESS`, CI `vars.SUBMISSION_FEE_ADDRESS`). Mainnet fee address remains TBD until ops publishes a `bc1…` (Workers `SUBMISSION_FEE_ADDRESS`).

## Claim abuse mitigations (provisional)

See `plebly.fund/docs/claim-abuse-mitigations.md` (risk register). Changes require the same public process and thirty-day notice.

| Parameter | Proposed default |
|-----------|------------------|
| Claim bond | 10,000 sats (exact, to submission-fee / ops fee address) |
| Max active claims | 1 (pending + exclusive claimed / in_review) |
| Claim pending TTL | 72 hours |
| Reclaim cooldown | 30 days (after expiry, final_rejected, or abandoned release) |
| Claim checkpoint day | 45 (from claim acceptance) |
| Claim checkpoint grace | 7 days |
| Claim abuse escalation threshold | 2 (expired/abandoned without completion → 2× bond) |
| Max site claim PRs per day | 10 (Worker global) |
| Identity relink cooldown | 7 days |

<!-- parameters:generated:end -->

### Bond rules

- Bond is paid to the **submission fee / ops fee address**, not the project escrow (does not count toward claim floor).
- **Refunded** (keyholder batch) when status reaches `completed`.
- **Forfeited** on claim-window expiry, abandoned release after checkpoint miss, or clear bond fraud.
- Reused bond txids are rejected.

### Suspension (last resort, public)

Temporary claim suspension may be set for: bond fraud, fee/bond txid replay, or sustained rate-limit evasion. Reason is always public on the profile. No silent bans.

## Addresses (TBD before launch)

| Role | Address / descriptor |
|------|----------------------|
| Submission fee (signet) | `tb1qhj27cegpek02g8g4peps0x7gqs0svvs888svyz` — currently **shared** with smoke-demo escrow receive; split to a dedicated Sparrow receive when ready |
| Submission fee (mainnet) | `TBD` (`bc1…`) |
| Platform ops (fee receive) | Same as submission fee unless published separately (2.5% at disbursement is keyholder-enforced; Worker returns advisory sats) |
| Claim bond receive | Same as submission fee unless published separately |
| Escrow receive descriptor template | See `KEYHOLDERS.md` |

Publish mainnet fee address here, then set Worker `SUBMISSION_FEE_ADDRESS` + GitHub `vars.SUBMISSION_FEE_ADDRESS` (see [`docs/mainnet-launch-ops.md`](docs/mainnet-launch-ops.md) §A).

## Network

| Mode | Chain | Escrow |
|------|-------|--------|
| **Testing (now)** | Signet | Single `TEST_ESCROW_ADDRESS` you control — see `TESTING.md` |
| **Launch** | Mainnet only | 3-of-5 multisig — see `KEYHOLDERS.md` |

Workers default: `BITCOIN_NETWORK=signet`, mempool `https://mempool.space/signet/api`. Numeric knobs (including per-network claim floor) live in `parameters.json`.

## Residual trust (Q21)

v1 escrow has **no on-chain timelock** forcing keyholders to sign. If reviewers approve but keyholders stall, ops follows `docs/keyholder-stall-runbook.md` (7d public log / 14d incident) and may set a site `release_blocked_reason` banner via `/escrow/stall`. Escrow mechanism upgrades require a public process with ≥30-day notice.
