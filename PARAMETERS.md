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

## Addresses (TBD before launch)

| Role | Address / descriptor |
|------|----------------------|
| Submission fee | `TBD` |
| Platform ops (fee receive) | `TBD` |
| Escrow receive descriptor template | See `KEYHOLDERS.md` |

## Network

| Mode | Chain | Escrow |
|------|-------|--------|
| **Testing (now)** | Signet | Single `TEST_ESCROW_ADDRESS` you control — see `TESTING.md` |
| **Launch** | Mainnet only | 3-of-5 multisig — see `KEYHOLDERS.md` |

Workers default: `BITCOIN_NETWORK=signet`, mempool `https://mempool.space/signet/api`.
