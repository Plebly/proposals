# Parameters

Fixed at first public submission. Changes require a public process and thirty-day notice.

## Section VII (launch-locked)

| Parameter | Value |
|-----------|-------|
| Submission fee | 10,000 sats (exact, non-refundable) |
| Platform fee | 2.5% of escrow at successful disbursement |
| Milestone threshold | 1,000,000 sats |
| Minimum funding (claim floor) | 100,000 sats |
| Claim window | 90 days from claim acceptance |
| Claim extension | One 30-day extension via reviewer supermajority |

## Provisional (ratify before launch)

| Parameter | Proposed default |
|-----------|------------------|
| Active funding window | 180 days from escrow address allocation |
| Funding window extension | One 90-day extension via reviewer vote |
| Idle claimable → contributor ballot | 365 days with no claim |
| Badge: Notable Contributor | 21,000 sats (per proposal) |
| Badge: Major Contributor | 100,000 sats |
| Badge: Patron | 1,000,000 sats |
| Submission fee confirmations | 1 |
| Funding / badge / vote confirmations | 3 |
| Completion finality confirmations | 3 |

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
| Submission fee | `TBD` |
| Platform ops (fee receive) | `TBD` |
| Claim bond receive | Same as submission fee unless published separately |
| Escrow receive descriptor template | See `KEYHOLDERS.md` |

## Network

| Mode | Chain | Escrow |
|------|-------|--------|
| **Testing (now)** | Signet | Single `TEST_ESCROW_ADDRESS` you control — see `TESTING.md` |
| **Launch** | Mainnet only | 3-of-5 multisig — see `KEYHOLDERS.md` |

Workers default: `BITCOIN_NETWORK=signet`, mempool `https://mempool.space/signet/api`.
