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

This is the launch gate. Reviewer bootstrap is not. Target is 3-of-5 in Sparrow. **Interim launch is 2-of-3** (three named xpubs). Worker allocate needs `ESCROW_DESCRIPTOR` + `ESCROW_ADDRESS_MAP` and no `TEST_ESCROW_ADDRESS` — it does not count names in this file.

**Status:** roster + descriptor still TBD (human publish). Ops sequence: [`docs/mainnet-launch-ops.md`](docs/mainnet-launch-ops.md) §B. After publishing, set Worker secrets `ESCROW_DESCRIPTOR` and `ESCROW_ADDRESS_MAP` (JSON index→address). v1 does **not** derive addresses in-Worker. Stall runbook: `docs/keyholder-stall-runbook.md` (Q21).

## Ceremony (do this now)

1. Name **three** people. No one holds two keys. At least one holds no other formal Plebly role.
2. Each creates a **signet** 2-of-3 first (dress rehearsal), then a **mainnet** 2-of-3, on their own hardware. Export xpubs / origin paths. Never paste a seed.
3. One coordinator builds `wsh(sortedmulti(2,…))` in Sparrow, derives receive indices `0`, `1`, …, and writes this file.
4. Set Worker secrets `ESCROW_DESCRIPTOR` + `ESCROW_ADDRESS_MAP`. Remove `TEST_ESCROW_ADDRESS`.
5. On signet: allocate, quiet-close a bounty, cosign the release (including the fee output). That is the rehearsal. Then repeat the descriptor for mainnet and flip.

Two of three can spend. That is weaker than 3-of-5. Coins already at a 2-of-3 address do not move to a later 3-of-5 without a spend. Grow by 30-day descriptor notice + new map, not by editing this file after sats arrive.

## Identity onboarding (site)

Two layers. Do not mix them.

1. **Custody** — this file + Sparrow `wsh(sortedmulti)` + `ESCROW_DESCRIPTOR` / `ESCROW_ADDRESS_MAP`. Coins move only when those humans sign.
2. **Worker registry** — GitHub ↔ fingerprint / xpub so the site can show a roster and later seats can be co-attested.

**First two Worker seats (chicken-and-egg):** co-attest needs two actives, so the SPA apply path cannot start the roster. Ops runs [`scripts/bootstrap-keyholders-genesis.sh`](scripts/bootstrap-keyholders-genesis.sh) once (`POST /keyholders/genesis`). Those two become `active` immediately. A third Sparrow cosigner is invited or applies after, and the pair co-attests. Never paste a seed.

**Later seats:** `/keyholders` — earn a review, apply, register keys, two actives co-attest. That form does **not** update this descriptor.

## Rules

- No organization or individual holds more than one escrow key.
- At least two keyholders hold no other formal role in Plebly (when five are seated; with three, at least one independent).
- Escrow mechanism upgrades require a public process with ≥30-day notice.
- Platform ops uses the same keyholders under a **separate** published descriptor/account.

## Escrow descriptor template (TBD)

Interim (three seats):

```
wsh(sortedmulti(2,
  [FINGERPRINT1/87h/0h/0h]xpub.../0/*,
  [FINGERPRINT2/87h/0h/0h]xpub.../0/*,
  [FINGERPRINT3/87h/0h/0h]xpub.../0/*
))
```

Target (five seats):

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
