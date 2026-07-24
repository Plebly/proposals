# Keyholders

3-of-5 escrow multisig coordinated in Sparrow. Public keys / xpubs published here before first submission.

## Rules

- No organization or individual holds more than one escrow key.
- At least two keyholders hold no other formal role in Plebly.
- Escrow mechanism upgrades require a public process with ≥30-day notice.
- Platform ops uses the same five keyholders under a **separate** published descriptor/account.

## Escrow descriptor template (TBD)

```
wsh(sortedmulti(3,
  [FINGERPRINT1/87h/0h/0h]xpub.../0/*,
  [FINGERPRINT2/87h/0h/0h]xpub.../0/*,
  [FINGERPRINT3/87h/0h/0h]xpub.../0/*,
  [FINGERPRINT4/87h/0h/0h]xpub.../0/*,
  [FINGERPRINT5/87h/0h/0h]xpub.../0/*
))
```

Per-proposal receive address = descriptor at `/0/<escrow_index>` (see `ESCROW_INDEX.md`).
Change chain `/1/*` is for keyholder change only — never publish as a deposit address.

## Roster (TBD)

| # | Name | Role notes | xpub / origin |
|---|------|------------|---------------|
| 1 | TBD | | |
| 2 | TBD | | |
| 3 | TBD | | |
| 4 | TBD | Independent (no other Plebly role) | |
| 5 | TBD | Independent (no other Plebly role) | |
