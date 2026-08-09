# Testing on Signet (single-key)

Production uses 3-of-5 multisig (see below). **For development, use one signet wallet you control.**

## Signet test setup

1. In Sparrow (or Bitcoin Core), create a **Signet** wallet (not mainnet).
2. Copy a **receive address** (`tb1…`).
3. Set in `workers/wrangler.toml`:
   - `TEST_ESCROW_ADDRESS = "tb1…your address…"`
   - `TEST_SUBMISSION_FEE_ADDRESS = "tb1…"` (can be same wallet, different address)
4. `npm run deploy` in `workers/`
5. Fund from a signet faucet if needed.

All test proposals share `TEST_ESCROW_ADDRESS` on signet. You can send and receive without coordinating keyholders.

## What this is not

- Not non-custodial production escrow
- Not a rehearsal of multisig release
- Do not use for real mainnet bounties

Switch to the production block below before launch.

---

# Production keyholders (mainnet — fill before first public submission)

3-of-5 escrow multisig coordinated in Sparrow. Public keys / xpubs **must** be published here before first **mainnet** submission. Until then Workers return `501 pending_keyholders` from `/escrow/allocate` on mainnet.

**Status:** roster + descriptor still TBD (human publish). Ops sequence: [`docs/mainnet-launch-ops.md`](docs/mainnet-launch-ops.md) §B. After publishing, set Worker secrets `ESCROW_DESCRIPTOR` and `ESCROW_ADDRESS_MAP` (JSON index→address). v1 does **not** derive addresses in-Worker. Stall runbook: `docs/keyholder-stall-runbook.md` (Q21).

## Rules

- No organization or individual holds more than one escrow key.
- At least two keyholders hold no other formal role in Plebly.
- Escrow mechanism upgrades require a public process with ≥30-day notice.
- Platform ops uses the same five keyholders under a **separate** published descriptor/account.

## Escrow descriptor template (TBD)

```
wsh(sortedmulti(3,
  [FINGERPRINT1/87h/0h/0h]xpub.../0/*,
  ...
))
```

Per-proposal receive address = descriptor at `/0/<escrow_index>` (see `ESCROW_INDEX.md`).

## Roster (TBD)

| # | Name | Role notes | xpub / origin |
|---|------|------------|---------------|
| 1 | TBD | | |
| 2 | TBD | | |
| 3 | TBD | | |
| 4 | TBD | Independent | |
| 5 | TBD | Independent | |

## Platform identity (accountability, not custody)

Keyholders **sign only in Sparrow** (3-of-5). The Worker never holds keys, signs PSBTs, or broadcasts.

On-platform registry (`/keyholders` console):

- GitHub session bound to a published fingerprint + xpub
- **Dual active-keyholder co-attest** required to activate a seat (ops alone cannot activate)
- Disbursement queue packages releases / bond refunds / contributor refunds for Sparrow
- Settle requires on-chain txid verification; releases and contributor refunds need a second keyholder confirm
- PSBT artifacts are private to keyholders (not public media)

Publishing this markdown roster remains the human-readable source of truth for descriptors.
