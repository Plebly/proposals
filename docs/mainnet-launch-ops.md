# Mainnet launch ops checklist

Executable ops steps for the pre-mainnet gaps in `docs/system-as-implemented.md` §16.
Signet keeps working while these stay open; **mainnet allocate / fee CI / reviewer quorum** need the items below.

**Bounty money path (2026-09-13):** current-system writeup is [`bounty-psbt.md`](bounty-psbt.md). Monthly / `direct` is still A2 + `outcome: completed`. Do **not** flip until signet **A2b** (structure → hash-gate → Sparrow broadcast → dual-ack settle) has been run. First mainnet bounty spend is a Worker-built unsigned PSBT that humans broadcast — not the monthly auto-broadcast desk.

## A0. Signet bounty rehearsal (flip gate)

Run [`remaining-human-steps.md`](remaining-human-steps.md) §A2b on signet before `flip-to-mainnet.sh`:

1. Allocate a Type 1 bounty (no milestones). Schema freeze must stick (amend of allocations / reserve % / type → 400).
2. Fund until `GET /proposals/:id/structured-funding` is constructible. Broadcast the structure PSBT in Sparrow. Hook-confirm the txid.
3. Confirm `refund` / `timelock` / `reserve_refund` exist **before** award.
4. Award an on-chain payout. Challenge expire or flag selects `clean` or `disputed`.
5. Keyholders → Branches: hash-gate partials, download combined, broadcast in Sparrow. Dual-ack or hook-confirm settle.
6. After work outputs settle, confirm `reserve_refund` is selected.

Until that table is ticked, CI is the only proof. Monthly `outcome: completed` still 403s in `single-key-test`; that is a **different** path and does not replace A2b.

## A. Fee address + Completeness gate

1. Publish the mainnet submission-fee receive address in [`PARAMETERS.md`](../PARAMETERS.md) (replace `TBD`).
2. Set Worker secret (mainnet flip):
   ```bash
   cd workers
   npx wrangler secret put SUBMISSION_FEE_ADDRESS
   # paste bc1… address
   npx wrangler secret put FEE_RECEIVE_XPUB
   # paste watch-only account xpub/tpub (never xprv)
   ```
   Assignment of `FEE_RECEIVE_XPUB` or `FEE_ADDRESS_MAP` **is** the unique-receive toggle. `/health` `fee_address_mode` becomes `unique` immediately. No separate flag.
3. Set GitHub Actions repo variables on `Plebly/proposals`:
   ```bash
   gh variable set SUBMISSION_FEE_ADDRESS -R Plebly/proposals --body 'bc1…'
   gh variable set BITCOIN_NETWORK -R Plebly/proposals --body 'mainnet'
   gh variable set MEMPOOL_API -R Plebly/proposals --body 'https://mempool.space/api'
   ```
   While still on signet testing, use the signet fee address and `BITCOIN_NETWORK=signet` / signet mempool API (see current repo vars).
4. Require the Completeness workflow status check on `main` (branch protection or ruleset). Check name: **`validate`**.
5. Confirm a PR that touches `proposals/**/*.md` runs the on-chain fee gate (no “fee gate skipped” warning).

## B. Keyholders + escrow allocate

1. Fill the production roster + descriptor in [`KEYHOLDERS.md`](../KEYHOLDERS.md) (five xpubs; no party holds more than one key; ≥2 independents).
2. In Sparrow, derive a receive-address map for indices you will allocate (`0`, `1`, …).
3. Set Worker secrets:
   ```bash
   cd workers
   npx wrangler secret put ESCROW_DESCRIPTOR
   # paste wsh(sortedmulti(3,…))
   npx wrangler secret put ESCROW_ADDRESS_MAP
   # paste {"0":"bc1…","1":"bc1…",…}
   ```
4. **v1 does not derive addresses in-Worker** — keep refreshing `ESCROW_ADDRESS_MAP` offline as the index grows.
5. Second published descriptor, **same KH set**, not a hot wallet (needed for Type 1/2 dispute penalty and a real reserve path):
   ```bash
   npx wrangler secret put REVIEWER_ESCROW_DESCRIPTOR
   npx wrangler secret put REVIEWER_ESCROW_ADDRESS_MAP
   # paste {"0":"bc1…",…} derived in Sparrow from that descriptor
   ```
   Half-set (one var only) **fails closed**. Both unset → stand-in on the primary map — acceptable for signet, not for a mainnet dispute path.
6. Optional dedicated fee outputs on `clean` (else they fall back to ops):
   ```bash
   npx wrangler secret put BDI_FEE_ADDRESS
   npx wrangler secret put KEYHOLDER_POOL_ADDRESS
   ```
7. Smoke: with `BITCOIN_NETWORK=mainnet`, hook `POST /escrow/allocate` must not return `501 pending_keyholders` / `pending_address_map`.

## C. Bootstrap reviewers

Needs **exactly five** Plebly user ids (`github:{login}`, `x:{id}`, etc. — same shape as session `user.id`).

**Current blocker:** live `GET /reviewers` is empty (`count: 0`). Plebly GitHub org currently has two members (`secsovereign`, `MeABzZz`) — three more identities must be chosen before seeding. Seats are permanent.

```bash
# From proposals/
export HOOK_SECRET='…'   # from `cd workers && npx wrangler secret put HOOK_SECRET` value — never commit
export API='https://plebly-api.securesovereigns.workers.dev'
./scripts/bootstrap-reviewers.sh \
  'github:alice' 'github:bob' 'github:carol' 'github:dave' 'github:erin'
```

Then:

1. Mirror names/track record into [`REVIEWERS.md`](../REVIEWERS.md) bootstrap table.
2. Verify `GET $API/reviewers` shows `count: 5`.
3. Do not re-run with a different set (API rejects replace/expand once five bootstrap seats exist).

## D. Soft gaps (explicitly deferred for v1)

| Item | v1 stance |
|------|-----------|
| In-Worker descriptor → address derive | **Deferred** — Sparrow + `ESCROW_ADDRESS_MAP` / `REVIEWER_ESCROW_ADDRESS_MAP` |
| Automated refund batching (**direct**) | **Deferred** — `POST /refunds/register` + keyholder batch runbook |
| Bounty pool refund | **Shipped** — `refund` / `timelock` / `reserve_refund` branches; humans broadcast |
| Bounty / monthly PSBT signing or bounty broadcast in Worker | **Never** — humans sign and broadcast bounty combines in Sparrow |
| Lightning on default signet | **Off by design** — auto-on for mainnet/testnet; signet needs `LIGHTNING_ENABLED=true`. Bounty apply is on-chain only on every network. |

## E. Related secrets (not in the seven-gap list)

As of the last ops pass, Worker secrets present include GitHub App/OAuth, `HOOK_SECRET`, `SESSION_SECRET`. Still **missing** for mainnet / full product:

```bash
cd workers
npx wrangler secret put SUBMISSION_FEE_ADDRESS  # mainnet bc1… (signet uses TEST_* vars)
npx wrangler secret put ESCROW_DESCRIPTOR
npx wrangler secret put ESCROW_ADDRESS_MAP
npx wrangler secret put REVIEWER_ESCROW_DESCRIPTOR   # same KH set, second script
npx wrangler secret put REVIEWER_ESCROW_ADDRESS_MAP
npx wrangler secret put BDI_FEE_ADDRESS              # optional; else ops
npx wrangler secret put KEYHOLDER_POOL_ADDRESS       # optional; else ops
npx wrangler secret put ANTHROPIC_API_KEY       # else AI triage → ambiguous
npx wrangler secret put X_CLIENT_ID
npx wrangler secret put X_CLIENT_SECRET
```

## F. Ops pass already applied (signet)

- GitHub `vars.SUBMISSION_FEE_ADDRESS` / `BITCOIN_NETWORK` / `MEMPOOL_API` set for **signet** fee CI.
- Branch protection on `Plebly/proposals` `main`: required status check **`validate`**, `enforce_admins`, no force-push.
- Bootstrap helper: `scripts/bootstrap-reviewers.sh`.

Before flipping `BITCOIN_NETWORK` to `mainnet` in `wrangler.toml` / deploy vars, finish **A0 + A–C** with mainnet values. First mainnet bounty: humans broadcast the combined branch PSBT in Sparrow, then dual-ack or hook-confirm the txid.
