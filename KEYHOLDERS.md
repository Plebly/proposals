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

Ops: after publishing the descriptor, set Worker secrets `ESCROW_DESCRIPTOR` and `ESCROW_ADDRESS_MAP` (JSON index→address). See `docs/keyholder-stall-runbook.md` (Q21).

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
