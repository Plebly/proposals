# Mainnet launch ops checklist

Executable ops steps for the pre-mainnet gaps in `docs/system-as-implemented.md` §16.
Signet keeps working while these stay open; **mainnet allocate / fee CI / reviewer quorum** need the items below.

## A. Fee address + Completeness gate

1. Publish the mainnet submission-fee receive address in [`PARAMETERS.md`](../PARAMETERS.md) (replace `TBD`).
2. Set Worker secret (mainnet flip):
   ```bash
   cd workers
   npx wrangler secret put SUBMISSION_FEE_ADDRESS
   # paste bc1… address
   ```
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
5. Smoke: with `BITCOIN_NETWORK=mainnet`, hook `POST /escrow/allocate` must not return `501 pending_keyholders` / `pending_address_map`.

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
| In-Worker descriptor → address derive | **Deferred** — Sparrow + `ESCROW_ADDRESS_MAP` |
| Automated refund batching | **Deferred** — `POST /refunds/register` + keyholder batch runbook |
| Lightning on signet | **Always off** — Boltz has no signet pair; use `BITCOIN_NETWORK=testnet` for LN staging; auto-on for mainnet |

## D2. One-command flip (after A–C secrets exist)

```bash
cd workers
cp deploy/mainnet.env.example deploy/mainnet.env
# fill PROPOSALS_SUBMISSION_FEE_ADDRESS=bc1…
./scripts/flip-to-mainnet.sh --env deploy/mainnet.env --confirm
npm run smoke:mainnet
```

The script patches `wrangler.toml` network vars, comments out `TEST_*`, prompts for Worker secrets, sets GitHub vars on `Plebly/proposals` + `Plebly/plebly.fund`, deploys, and runs readiness smoke. It does **not** invent KEYHOLDERS or bootstrap reviewers.

## E. Related secrets (not in the seven-gap list)

As of the last ops pass, Worker secrets present include GitHub App/OAuth, `HOOK_SECRET`, `SESSION_SECRET`. Still **missing** for mainnet / full product:

```bash
cd workers
npx wrangler secret put SUBMISSION_FEE_ADDRESS  # mainnet bc1… (signet uses TEST_* vars)
npx wrangler secret put ESCROW_DESCRIPTOR
npx wrangler secret put ESCROW_ADDRESS_MAP
npx wrangler secret put ANTHROPIC_API_KEY       # else AI triage → ambiguous
npx wrangler secret put X_CLIENT_ID
npx wrangler secret put X_CLIENT_SECRET
```

## F. Ops pass already applied (signet)

- GitHub `vars.SUBMISSION_FEE_ADDRESS` / `BITCOIN_NETWORK` / `MEMPOOL_API` set for **signet** fee CI.
- Branch protection on `Plebly/proposals` `main`: required status check **`validate`**, `enforce_admins`, no force-push.
- Bootstrap helper: `scripts/bootstrap-reviewers.sh`.

Before flipping `BITCOIN_NETWORK` to `mainnet` in `wrangler.toml` / deploy vars, finish A–C with mainnet values.
