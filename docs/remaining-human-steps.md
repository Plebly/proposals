# Remaining human steps — signet, then mainnet

**Date:** 2026-07-25  
**Audience:** ops / keyholders / whoever will run live money-path tests  
**Code status:** signet Worker + SPA are deployed; automated tests and read-only smoke pass. This doc is only what humans still must do.

Related: [`TESTING.md`](../proposals/TESTING.md), [`KEYHOLDERS.md`](../proposals/KEYHOLDERS.md), [`mainnet-launch-ops.md`](mainnet-launch-ops.md), [`system-as-implemented.md`](system-as-implemented.md).

---

## What is already done (do not redo)

- Workers API on **signet** with mempool signet, fee/escrow test vars, GitHub App/OAuth
- SPA on **signet** (`VITE_BITCOIN_NETWORK` via Pages repo vars)
- Fee CI vars + `validate` required on `Plebly/proposals` `main`
- Flip tooling: `workers/scripts/flip-to-mainnet.sh`, `npm run smoke:mainnet`
- Network-safe fee address selection (signet `TEST_*` vs mainnet `SUBMISSION_FEE_ADDRESS`)
- Lightning **always off** on signet (no Boltz signet pair)

---

## Part A — Full signet testing (human)

Signet escrow is **`escrow_mode: single-key-test`**, not production 3-of-5. Allocate always returns one shared `TEST_ESCROW_ADDRESS` and labels the response. Workers do not generate or hold that key. **`POST /claims/outcome` completed (release authorization) is refused in this mode** — multisig is required for disbursement.

### A1. Wallet you control (required for any spend)

The live deploy still points at the public BIP39 test-vector address `tb1qacjkk…`. That is observe-only unless you control the key (you almost certainly do not).

1. Sparrow → Network → **Signet** → create or open a wallet (this creates the private key material locally).
2. Copy two receive addresses (or reuse one):
   - escrow receive
   - fee/bond receive
3. Set in `workers/wrangler.toml` and redeploy:
   ```toml
   TEST_ESCROW_ADDRESS = "tb1…your_escrow…"
   TEST_SUBMISSION_FEE_ADDRESS = "tb1…your_fee…"
   ```
   ```bash
   cd workers && npx wrangler deploy
   curl -sS https://plebly-api.securesovereigns.workers.dev/health | jq .
   # expect fee_address_configured=true, escrow_ready=true, lightning_enabled=false
   ```
4. Update demo proposal `escrow_address` (or list a new proposal) to your escrow address before funding it.
5. Get signet sats (faucet), then fund your fee + escrow addresses as needed.

### A2. Money-path rehearsal (opt-in spend)

| Step | What you do | Notes |
|------|-------------|--------|
| Submission fee | Send **exact** 10,000 sats to `TEST_SUBMISSION_FEE_ADDRESS`, keep txid | Exact amount required; txid is one-time (`paytxid`) |
| Submit / amend | Log in on plebly.fund, submit or edit a proposal | Needs GitHub session |
| Allocate | Hook `POST /escrow/allocate` (or rely on listing flow) | Signet → your single test escrow address |
| Donate | Send signet sats to escrow | Balance from mempool.space/signet |
| Claim floor | Fund escrow to **≥ 100,000** sats confirmed (param) | Or temporarily lower floor only on a test branch |
| Claim bond | Send **exact** 10,000 sats bond, claim in UI | Bond is marked spent at verify even if PR never merges |
| Deliverable + review | Submit deliverable; exercise review UI | Needs reviewers (A3) |

Read-only check anytime: `cd workers && npm run smoke:signet` (never broadcasts).

### A3. Reviewer quorum (required for review e2e)

Live roster is empty (`GET /reviewers` → `count: 0`). Seats are permanent once seeded.

1. Choose **exactly five** Plebly user ids (`github:{login}`, `x:{id}`, or `nostr:{pubkey}` — same shape as session `user.id`).
2. Seed:
   ```bash
   cd proposals
   export HOOK_SECRET='…'   # Worker secret; never commit
   export API='https://plebly-api.securesovereigns.workers.dev'
   ./scripts/bootstrap-reviewers.sh \
     'github:…' 'github:…' 'github:…' 'github:…' 'github:…'
   ```
3. Mirror identities into `REVIEWERS.md` and open a PR.
4. Confirm `GET $API/reviewers` shows `count: 5`.

### A4. Optional signet product completeness

| Item | Why | How |
|------|-----|-----|
| `ANTHROPIC_API_KEY` | AI first-pass triage; without it reviews go ambiguous | `npx wrangler secret put ANTHROPIC_API_KEY` |
| X OAuth secrets | X login path | `X_CLIENT_ID` / `X_CLIENT_SECRET` |
| Operator-owned demo listing | Site shows a real funded project you can spend against | Update/list proposal with your escrow |

### A5. What signet does **not** rehearse

Default signet is **not** a multisig dress rehearsal (`KEYHOLDERS.md`: “Not a rehearsal of multisig release”).

Skipped unless you deliberately set up a separate signet 3-of-5:

- Production descriptor allocate (`ESCROW_DESCRIPTOR` + `ESCROW_ADDRESS_MAP`)
- 3-of-5 cooperative release after approval
- Keyholder stall / residual-trust runbook with real cosigners
- Lightning donate → escrow (Boltz has no signet pair; use `BITCOIN_NETWORK=testnet` if you need LN staging)

If you want a multisig rehearsal before mainnet, that is an extra human project: five signet xpubs → test descriptor → Sparrow address map → exercise allocate/release offline with those keys. It is not what the current signet Worker path does.

---

## Part B — Mainnet launch (human, after signet is good)

Do not flip until Part A money path and reviewer bootstrap are acceptable.

### B1. Fee address + Completeness

1. Publish mainnet fee receive address in `PARAMETERS.md` (replace `TBD`).
2. Worker secret: `npx wrangler secret put SUBMISSION_FEE_ADDRESS`
3. GitHub vars on `Plebly/proposals`: `SUBMISSION_FEE_ADDRESS`, `BITCOIN_NETWORK=mainnet`, `MEMPOOL_API=https://mempool.space/api`
4. Confirm fee gate on PRs no longer skips / warns as unset

### B2. Keyholders + escrow map

1. Fill production roster + 3-of-5 descriptor in `KEYHOLDERS.md` (five xpubs; no party holds more than one key; ≥2 independents).
2. In Sparrow, derive receive addresses for indices you will allocate (`0`, `1`, …).
3. Worker secrets:
   - `ESCROW_DESCRIPTOR`
   - `ESCROW_ADDRESS_MAP` (JSON `{"0":"bc1…","1":"bc1…",…}`)
4. v1 does **not** derive in-Worker — refresh the map offline as the index grows.
5. After flip, hook allocate must not return `pending_keyholders` / `pending_address_map`.

### B3. Bootstrap reviewers (if not already done on signet identities you will keep)

Same five-seat rule. Prefer the identities that will operate mainnet; seats are permanent.

### B4. Flip + verify

```bash
cd workers
cp deploy/mainnet.env.example deploy/mainnet.env
# fill PROPOSALS_SUBMISSION_FEE_ADDRESS=bc1…
./scripts/flip-to-mainnet.sh --env deploy/mainnet.env --confirm
npm run smoke:mainnet
```

Confirm:

- `/health` → `network=mainnet`, `fee_address_configured`, `escrow_ready`, `lightning_enabled=true` (unless explicitly disabled)
- `/claims/params` fee address is `bc1…` (not `tb1…`)
- Pages rebuild with `VITE_BITCOIN_NETWORK=mainnet`
- Lightning donate UI appears; first invoice/swap smoke on mainnet amounts you accept losing to fees

### B5. Soft / deferred (not blockers for v1 launch)

| Item | Stance |
|------|--------|
| In-Worker descriptor → address derive | Deferred — Sparrow map |
| Automated refund batching | Deferred — register + keyholder batch |
| Multisig release automation | Intentional human cosign + runbooks |

---

## Quick priority order

**Signet (now)**  
1. Your Sparrow signet wallet → replace `TEST_*` addresses → redeploy  
2. Faucet + exact fee/bond + fund escrow to claim floor  
3. Bootstrap five reviewers  
4. Optional: Anthropic key for AI triage  

**Mainnet (later)**  
1. KEYHOLDERS + Sparrow map  
2. Mainnet fee address in PARAMETERS + secrets/vars  
3. `flip-to-mainnet.sh` + `smoke:mainnet`  
4. First real allocate + LN smoke with small amounts  

---

## Explicit non-goals for humans right now

- Do not invent KEYHOLDERS xpubs in git  
- Do not seed bootstrap with throwaway ids you will regret (seats are permanent)  
- Do not fund the public `tb1qacjkk…` vector unless you control that seed  
- Do not expect Lightning on the default signet deploy  
