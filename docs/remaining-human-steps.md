# Remaining human steps — signet, then mainnet

**Date:** 2026-07-25  
**Audience:** ops / keyholders / whoever will run live money-path tests  
**Code status:** Workers `1341574` + SPA on **signet**; escrow mode hard boundary is live (`escrow_mode: single-key-test`). Automated tests and read-only smoke pass. This doc is only what humans still must do.

Related: [`system-as-implemented.md`](system-as-implemented.md), [`mainnet-launch-ops.md`](mainnet-launch-ops.md), [`TESTING.md`](../proposals/TESTING.md), [`KEYHOLDERS.md`](../proposals/KEYHOLDERS.md).

---

## What is already done (do not redo)

- Workers API + SPA on **signet** (mempool signet, GitHub App/OAuth)
- Fee CI vars + `validate` required on `Plebly/proposals` `main`
- Network-safe fee address selection (`TEST_SUBMISSION_FEE_ADDRESS` on signet; `SUBMISSION_FEE_ADDRESS` on mainnet)
- Lightning **always off** on signet (no Boltz pair)
- Escrow **hard mode boundary** (`lib/escrow-mode.ts`):
  - `single-key-test` vs `multisig` vs misconfigured (503 refuse)
  - allocate responses include `escrow_mode`
  - `/health` reports mode + map capacity fields
  - `POST /claims/outcome` `completed` **refused** in single-key-test (`multisig_required_for_release`)
- Flip tooling: `workers/scripts/flip-to-mainnet.sh`, `npm run smoke:signet`, `npm run smoke:mainnet`
- Pages build env from repo vars (`VITE_BITCOIN_NETWORK`, etc.)

Live check:

```bash
curl -sS https://plebly-api.securesovereigns.workers.dev/health | jq '{ok,network,escrow_mode,escrow_descriptor_set,escrow_map_remaining,lightning_enabled}'
# expect: ok=true, network=signet, escrow_mode=single-key-test, escrow_descriptor_set=false
```

---

## Part A — Full signet testing (human)

Deployed mode is **`escrow_mode: single-key-test`**. Allocate returns one shared `TEST_ESCROW_ADDRESS` and labels every response. Workers do not hold that key.

**Important limit:** you can rehearse fee → submit → allocate → fund → claim → deliverable → review ballots on signet, but you **cannot** authorize disbursement via `POST /claims/outcome` `completed` until multisig mode is configured. That is intentional so the test shortcut cannot release funds.

### A1. Wallet you control (required for any spend)

The live deploy still points at the public BIP39 test-vector address `tb1qacjkk…`. Observe-only unless you control that key (you almost certainly do not).

1. Sparrow → Network → **Signet** → create or open a wallet (private keys stay local).
2. Copy two receive addresses (or reuse one): escrow + fee/bond.
3. Set **only** test vars (do **not** set `ESCROW_DESCRIPTOR` / `ESCROW_ADDRESS_MAP` or the Worker becomes misconfigured):
   ```toml
   BITCOIN_NETWORK = "signet"
   TEST_ESCROW_ADDRESS = "tb1…your_escrow…"
   TEST_SUBMISSION_FEE_ADDRESS = "tb1…your_fee…"
   ```
4. Deploy and confirm mode:
   ```bash
   cd workers && npx wrangler deploy
   curl -sS https://plebly-api.securesovereigns.workers.dev/health | jq .
   # expect escrow_mode=single-key-test, escrow_ready=true, lightning_enabled=false,
   #        escrow_config_error=null, escrow_descriptor_set=false
   ```
5. Point the demo (or a new listing) `escrow_address` at your escrow address before funding it.
6. Faucet fund fee + escrow addresses as needed.

### A2. Money-path rehearsal (opt-in spend)

| Step | What you do | Notes |
|------|-------------|--------|
| Submission fee | Exact **10,000** sats to `TEST_SUBMISSION_FEE_ADDRESS`, keep txid | One-time `paytxid` |
| Submit / amend | Log in on plebly.fund | GitHub session |
| Allocate | Hook `POST /escrow/allocate` | Response must show `escrow_mode: "single-key-test"` |
| Donate | Send signet sats to escrow | mempool.space/signet |
| Claim floor | Fund escrow to **≥ 100,000** sats confirmed | Or temporarily lower floor on a test branch only |
| Claim bond | Exact **10,000** sats bond, claim in UI | Bond spent at verify even if PR never merges |
| Deliverable + review | Submit deliverable; vote ballots | Needs reviewers (A3) |
| **Completed / release** | **Blocked on purpose** | `outcome: completed` → 403 until multisig mode |

Read-only anytime: `cd workers && npm run smoke:signet`.

### A3. Reviewer quorum (required for review e2e)

Live roster is empty (`GET /reviewers` → `count: 0`). Seats are permanent once seeded.

1. Choose **exactly five** user ids (`github:{login}`, `x:{id}`, or `nostr:{pubkey}`).
2. Seed:
   ```bash
   cd proposals
   export HOOK_SECRET='…'   # never commit
   export API='https://plebly-api.securesovereigns.workers.dev'
   ./scripts/bootstrap-reviewers.sh \
     'github:…' 'github:…' 'github:…' 'github:…' 'github:…'
   ```
3. Mirror into `REVIEWERS.md` via PR.
4. Confirm `count: 5`.

### A4. Optional signet completeness

| Item | Why | How |
|------|-----|-----|
| `ANTHROPIC_API_KEY` | AI first-pass; else ambiguous | `npx wrangler secret put ANTHROPIC_API_KEY` |
| X OAuth | X login | `X_CLIENT_ID` / `X_CLIENT_SECRET` |
| Operator-owned demo listing | Spend against a project you control | Update/list with your escrow |

### A5. Optional: signet multisig rehearsal (separate from default deploy)

Default signet is **not** a 3-of-5 dress rehearsal. To rehearse multisig **before** mainnet:

1. Build a **signet** 3-of-5 (or test multisig) in Sparrow; derive an address map.
2. **Remove** `TEST_ESCROW_ADDRESS` from Worker vars.
3. Set secrets `ESCROW_DESCRIPTOR` + `ESCROW_ADDRESS_MAP`.
4. Redeploy; `/health` must show `escrow_mode=multisig`, `escrow_map_remaining > 0`, `escrow_test_address_set=false`.
5. Allocate (per-index addresses), then `outcome: completed` is allowed by the Worker gate.
6. Actual cosign / broadcast of the release tx remains a human Sparrow operation.

Lightning still needs `BITCOIN_NETWORK=testnet` (or mainnet); Boltz has no signet pair.

---

## Part B — Mainnet launch (human, after signet is good)

Do not flip until Part A spend path and reviewer bootstrap are acceptable. Flip **must** leave the Worker in valid **multisig** mode (descriptor + map present, `TEST_ESCROW_ADDRESS` absent) or traffic is refused.

### B1. Fee address + Completeness

1. Publish mainnet fee address in `PARAMETERS.md` (replace `TBD`).
2. `npx wrangler secret put SUBMISSION_FEE_ADDRESS`
3. GitHub vars on `Plebly/proposals`: `SUBMISSION_FEE_ADDRESS`, `BITCOIN_NETWORK=mainnet`, `MEMPOOL_API=https://mempool.space/api`
4. Confirm fee gate on PRs no longer skips

### B2. Keyholders + escrow map

1. Fill production roster + 3-of-5 descriptor in `KEYHOLDERS.md`.
2. Sparrow-derive receive addresses for indices you will allocate (`0`, `1`, …).
3. Secrets: `ESCROW_DESCRIPTOR`, `ESCROW_ADDRESS_MAP` (`{"0":"bc1…",…}`).
4. **Remove** `TEST_ESCROW_ADDRESS` / `TEST_SUBMISSION_FEE_ADDRESS` from `wrangler.toml` vars (flip script comments them out).
5. Watch `/health` `escrow_map_remaining`; refresh the map before exhaustion (`escrow_map_exhausted`).

### B3. Bootstrap reviewers

Same five-seat rule if not already seeded with identities you will keep on mainnet.

### B4. Flip + verify

```bash
cd workers
cp deploy/mainnet.env.example deploy/mainnet.env
# fill PROPOSALS_SUBMISSION_FEE_ADDRESS=bc1…
./scripts/flip-to-mainnet.sh --env deploy/mainnet.env --confirm
npm run smoke:mainnet
```

Confirm:

| Check | Expect |
|-------|--------|
| `/health` | `network=mainnet`, `escrow_mode=multisig`, `escrow_ready=true`, `escrow_descriptor_set=true`, `escrow_test_address_set=false`, `escrow_map_remaining≥1`, `lightning_enabled=true` (unless forced off) |
| `/claims/params` | fee address `bc1…` (not `tb1…`) |
| Pages | `VITE_BITCOIN_NETWORK=mainnet` rebuild |
| Allocate | `escrow_mode: "multisig"`, unique map address |
| First LN smoke | Small amount you accept losing to Boltz fees |
| First `outcome: completed` | Allowed by Worker; cosign release in Sparrow |

### B5. Soft / deferred (not v1 launch blockers)

| Item | Stance |
|------|--------|
| In-Worker descriptor → address derive | Deferred — Sparrow map |
| Automated refund batching | Deferred — register + keyholder batch |
| Multisig PSBT signing in Worker | Never — human cosign + runbooks |

---

## Quick priority order

**Signet (now)**  
1. Your Sparrow signet wallet → replace `TEST_*` → redeploy → confirm `escrow_mode=single-key-test`  
2. Faucet + exact fee/bond + fund escrow to claim floor  
3. Bootstrap five reviewers  
4. Optional: Anthropic key  
5. Remember: no `completed` release until multisig mode  

**Mainnet (later)**  
1. KEYHOLDERS + Sparrow map; remove `TEST_ESCROW_ADDRESS`  
2. Mainnet fee in PARAMETERS + secrets/vars  
3. `flip-to-mainnet.sh` + `smoke:mainnet` (`escrow_mode=multisig`)  
4. First allocate + LN smoke + real cosigned release  

---

## Explicit non-goals for humans right now

- Do not invent KEYHOLDERS xpubs in git  
- Do not seed bootstrap with throwaway ids (seats are permanent)  
- Do not fund the public `tb1qacjkk…` vector unless you control that seed  
- Do not expect Lightning on the default signet deploy  
- Do not set `TEST_ESCROW_ADDRESS` together with descriptor/map (Worker refuses all traffic)  
- Do not expect `outcome: completed` to succeed while `escrow_mode=single-key-test`  
