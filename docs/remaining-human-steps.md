# Remaining human steps — signet, then mainnet

**Date:** 2026-07-27  
**Audience:** ops / keyholders / whoever will run live money-path tests  
**Code status:** High + soft-launch product gaps that can be fixed in code are shipped (Workers + SPA on `main`). Live deploy is still **signet** / `escrow_mode: single-key-test` until you flip. Protocol-repo leftovers land via [Plebly/proposals#7](https://github.com/Plebly/proposals/pull/7). This doc is **only** what humans still must do.

Related: [`system-as-implemented.md`](system-as-implemented.md), [`post-mvp-roadmap.md`](post-mvp-roadmap.md), [`mainnet-launch-ops.md`](mainnet-launch-ops.md), [`TESTING.md`](../proposals/TESTING.md), [`KEYHOLDERS.md`](../proposals/KEYHOLDERS.md), [`REVIEWERS.md`](../proposals/REVIEWERS.md).

### After MVP

Launch blockers stay in this checklist. Product expansion beyond governance is in [`post-mvp-roadmap.md`](post-mvp-roadmap.md). **Parameter votes** stay deferred until eligibility / quorum / activation rules are published in `PARAMETERS.md`.

---

## What code already does (do not redo)

- Workers API + SPA on **signet** (mempool signet, GitHub App/OAuth)
- Escrow hard mode boundary (`single-key-test` | `multisig` | refuse)
- Live `TEST_*` addresses point at **operator Sparrow signet receives** (listed demos updated; [PR #6](https://github.com/Plebly/proposals/pull/6) on `main`)
- Reviewer bootstrap / earn / funder removal / decision quorum
- Ops roles: nominate / vote / tally (volume-gated; no custody)
- Claim extension request UI + **one-shot** +30d on approve (no stacking; `409` if reused)
- Funding-window `extend` ballot → **one-shot** +90d (`fundext:`)
- Listing challenge UI (eligible funder → reviewer ballot → decline PR)
- SPA `/declined` archive + funder contributor badges (when amount is public)
- Platform fee: `completed` outcome returns `platform_fee` advisory (2.5%) for keyholders
- `POST /claims/outcome` `completed` binds to tallied `deliverable_confirm` / `second_review` via `decision_id` (or audited `force:true` + `force_note`; mainnet also needs `ALLOW_FORCE_OUTCOME=true`)
- Cron auto-tallies expired review / removal / ops-role ballots
- Flip tooling: `workers/scripts/flip-to-mainnet.sh`, smoke scripts

**Pending merge onto proposals `main` ([PR #7](https://github.com/Plebly/proposals/pull/7)):**

- `docs/governance/reviewer-removals.md` seed (removal evidence/result PRs fall back to `REVIEWERS.md` until then)
- `SEQUENCE.md` + `scripts/assign-sequence.mjs`
- Allocate-on-merge workflow/script (needs secrets after merge — see A4)
- PARAMETERS signet fee string alignment + all-zero fee-txid allowlist for seed demos only

Live check:

```bash
curl -sS https://plebly-api.securesovereigns.workers.dev/health | jq '{ok,network,escrow_mode,escrow_ready,escrow_descriptor_set,escrow_test_address_set,lightning_enabled,ai_review,x_oauth,mainnet_secrets_present}'
# expect today: ok=true, network=signet, escrow_mode=single-key-test,
#               escrow_ready=true, escrow_test_address_set=true, lightning_enabled=false,
#               ai_review=false, x_oauth=false, mainnet_secrets_present=false
curl -sS https://plebly-api.securesovereigns.workers.dev/reviewers | jq .count
# expect: 0 until you bootstrap
```

---

## Part A — Full signet testing (human)

Deployed mode is **`escrow_mode: single-key-test`**. Allocate returns the shared `TEST_ESCROW_ADDRESS` (`tb1qhj27cegpek02g8g4peps0x7gqs0svvs888svyz`). Workers do not hold that key.

**Important limit:** you can rehearse fee → submit → allocate → fund → claim → deliverable → review / extension / listing-challenge ballots on signet, but you **cannot** authorize disbursement via `POST /claims/outcome` `completed` until multisig mode is configured.

### A1. Wallet you control (required for any spend)

Listed demos and Worker `TEST_*` already use **your** Sparrow signet receives (smoke + Knots). Fee currently **shares** the smoke escrow receive — split when ready (A4).

1. Sparrow → Network → **Signet** → wallet that owns the live receives (keys stay local).
2. Optional: create a **dedicated** fee/bond receive (recommended before serious rehearsal accounting).
3. If you change addresses, set **only** test vars (do **not** set `ESCROW_DESCRIPTOR` / `ESCROW_ADDRESS_MAP` or the Worker becomes misconfigured):
   ```toml
   BITCOIN_NETWORK = "signet"
   TEST_ESCROW_ADDRESS = "tb1…your_escrow…"
   TEST_SUBMISSION_FEE_ADDRESS = "tb1…your_fee…"   # prefer ≠ escrow
   ```
4. Deploy and confirm mode:
   ```bash
   cd workers && npx wrangler deploy
   curl -sS https://plebly-api.securesovereigns.workers.dev/health | jq .
   # expect escrow_mode=single-key-test, escrow_ready=true, lightning_enabled=false,
   #        escrow_config_error=null, escrow_descriptor_set=false
   ```
5. Keep listed demo `escrow_address` fields aligned with Sparrow (already done for smoke + Knots).
6. Faucet fund fee + escrow addresses as needed.

### A2. Money-path rehearsal (opt-in spend)

| Step | What you do | Notes |
|------|-------------|--------|
| Submission fee | Exact **10,000** sats to `TEST_SUBMISSION_FEE_ADDRESS`, keep txid | One-time `paytxid` |
| Submit / amend | Log in on plebly.fund | GitHub session |
| Allocate | Hook `POST /escrow/allocate` (or post-merge workflow once #7 + secrets) | Response must show `escrow_mode: "single-key-test"` |
| Donate | Send signet sats to escrow | mempool.space/signet |
| Claim floor | Fund escrow to **≥ 100,000** sats confirmed | Or temporarily lower floor on a test branch only |
| Claim bond | Exact **10,000** sats bond, claim in UI | Bond spent at verify even if PR never merges |
| Deliverable + review | Submit deliverable; vote ballots | Needs reviewers (A3) |
| Extension (optional) | Fulfiller → **Request 30-day extension** on project | One-shot; reviewers approve; confirm `claim_window_ends_at` |
| Listing challenge (optional) | Eligible funder on listed/funding/claimable | Opens reviewer ballot; on pass → decline PR → `/declined` |
| Removal (optional) | Eligible funder on `/reviewers` | Evidence + result PRs (mirror path after #7 merges) |
| **Completed / release** | Hook with `decision_id` of tallied approve | **Blocked** until multisig: `outcome: completed` → 403 |

Read-only anytime: `cd workers && npm run smoke:signet`.

Completed outcome shape (once multisig):

```bash
curl -sS -X POST "$API/claims/outcome" \
  -H "X-Plebly-Hook-Secret: $HOOK_SECRET" \
  -H "content-type: application/json" \
  -d '{"proposal_id":"…","outcome":"completed","decision_id":"…-deliverable_confirm-r1-…"}'
```

Response includes `platform_fee` advisory (`platform_fee_sats`, `fulfiller_sats`, ops address). Keyholders include the 2.5% output at disbursement — Worker never moves funds.

`force: true` requires `force_note` (≥8 chars) and writes `forceoutcome:*` audit rows. On mainnet it also needs Worker var `ALLOW_FORCE_OUTCOME=true`. Avoid on real money.

### A3. Reviewer quorum (required for review e2e) — YOU

Live roster is empty until you seed (`GET /reviewers` → `count: 0`). Seats are **permanent**.

1. Choose **exactly five** final user ids (`github:{login}`, `x:{id}`, or `nostr:{pubkey}`).
2. Seed:
   ```bash
   cd proposals
   export HOOK_SECRET='…'   # never commit
   export API='https://plebly-api.securesovereigns.workers.dev'
   ./scripts/bootstrap-reviewers.sh \
     'github:…' 'github:…' 'github:…' 'github:…' 'github:…'
   ```
3. Mirror into `REVIEWERS.md` via PR (fill the bootstrap table).
4. Confirm `GET /reviewers` → `count: 5`.

Optional ops seats (coordination labels only):

```bash
curl -sS -X POST "$API/ops/roles/bootstrap" \
  -H "X-Plebly-Hook-Secret: $HOOK_SECRET" \
  -H "content-type: application/json" \
  -d '{"user_ids":["github:…","github:…"]}'
```

Role **votes** stay gated until ≥10 platform completions and ≥5 active reviewers.

### A4. Optional signet completeness

| Item | Why | How |
|------|-----|-----|
| Merge [proposals#7](https://github.com/Plebly/proposals/pull/7) | Removals mirror, SEQUENCE, allocate-on-merge, PARAMETERS/fee-gate | Review + merge to `main` |
| Dedicated signet fee receive | Split fees from smoke escrow balance | New Sparrow receive → `TEST_SUBMISSION_FEE_ADDRESS` + CI `vars.SUBMISSION_FEE_ADDRESS` |
| Allocate-on-merge secrets | Auto escrow after list merge | After #7: `secrets.PLEBLY_HOOK_SECRET` + `vars.PLEBLY_API_URL` on Plebly/proposals |
| `ANTHROPIC_API_KEY` | AI first-pass; else ambiguous | `npx wrangler secret put ANTHROPIC_API_KEY` |
| X OAuth | X login | `X_CLIENT_ID` / `X_CLIENT_SECRET` |
| Nostr event fanout | Optional ops broadcast | `NOSTR_OPS_NSEC` Worker secret |
| Replace seed zero fee txids | Before mainnet | Real 10k payments on demo listings (CI allowlist is signet-only) |
| GitHub bridge App (cross-repo) | Other projects label → Plebly draft | Publish App; set `GITHUB_WEBHOOK_SECRET`; install on test repo; set `vars.PLEBLY_BRIDGE_WEBHOOK=1` on proposals — see [`github-bridge.md`](github-bridge.md) |

### A5. Optional: signet multisig rehearsal (separate from default deploy)

Default signet is **not** a 3-of-5 dress rehearsal. To rehearse multisig **before** mainnet:

1. Build a **signet** 3-of-5 (or test multisig) in Sparrow; derive an address map.
2. **Remove** `TEST_ESCROW_ADDRESS` from Worker vars.
3. Set secrets `ESCROW_DESCRIPTOR` + `ESCROW_ADDRESS_MAP`.
4. Redeploy; `/health` must show `escrow_mode=multisig`, `escrow_map_remaining > 0`, `escrow_test_address_set=false`.
5. Allocate (per-index addresses), then `outcome: completed` with `decision_id` is allowed by the Worker gate.
6. Actual cosign / broadcast of the release tx remains a human Sparrow operation.

Lightning still needs `BITCOIN_NETWORK=testnet` (or mainnet); Boltz has no signet pair.

---

## Part B — Mainnet launch (human, after signet is good)

Do not flip until Part A spend path and reviewer bootstrap are acceptable. Flip **must** leave the Worker in valid **multisig** mode (descriptor + map present, `TEST_ESCROW_ADDRESS` absent) or traffic is refused.

### B1. Fee address + Completeness

1. Publish mainnet fee address in `PARAMETERS.md` (replace `TBD` with a real `bc1…`).
2. `npx wrangler secret put SUBMISSION_FEE_ADDRESS`
3. GitHub vars on `Plebly/proposals`: `SUBMISSION_FEE_ADDRESS`, `BITCOIN_NETWORK=mainnet`, `MEMPOOL_API=https://mempool.space/api`
4. Confirm fee gate on PRs no longer skips; all-zero fee txids fail on mainnet

### B2. Keyholders + escrow map — YOU (cannot be automated)

1. Name **five** keyholders; ≥2 hold no other formal Plebly role.
2. Fill production roster + 3-of-5 descriptor / xpubs in `KEYHOLDERS.md`.
3. Sparrow-derive receive addresses for indices you will allocate (`0`, `1`, …).
4. Secrets: `ESCROW_DESCRIPTOR`, `ESCROW_ADDRESS_MAP` (`{"0":"bc1…",…}`).
5. **Remove** `TEST_ESCROW_ADDRESS` / `TEST_SUBMISSION_FEE_ADDRESS` from Worker vars.
6. Watch `/health` `escrow_map_remaining`; refresh the map before exhaustion.

Keyholders stay **out of band forever** (Sparrow). There is no Worker election UI for keys — by design.

### B3. Bootstrap reviewers

Same five-seat rule if not already seeded with identities you will keep on mainnet. Do **not** reseed with different ids (rejected once five bootstrap seats exist).

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
| Pages | `VITE_BITCOIN_NETWORK=mainnet` rebuild + deploy |
| Allocate | `escrow_mode: "multisig"`, unique map address |
| First LN smoke | Small amount you accept losing to Boltz fees |
| First `outcome: completed` | Includes `decision_id` + `platform_fee` advisory; cosign release in Sparrow (2.5% ops output) |

### B5. Soft / deferred (not v1 launch blockers)

| Item | Stance |
|------|--------|
| In-Worker descriptor → address derive | Deferred — Sparrow map |
| Automated refund batching | Deferred — register + keyholder batch |
| Multisig PSBT signing in Worker | **Never** — human cosign + runbooks |
| Community parameter votes | Deferred — publish rules in `PARAMETERS.md` first |
| Keyholder replacement process | Human / Q21 stall runbook only |

---

## Quick priority order

**Signet (now)**  
1. Merge [proposals#7](https://github.com/Plebly/proposals/pull/7) (removals mirror / SEQUENCE / allocate-on-merge / fee gate)  
2. Optional: dedicated Sparrow fee receive ≠ smoke escrow → update `TEST_SUBMISSION_FEE_ADDRESS` + CI var  
3. Set allocate-on-merge secrets after #7  
4. Faucet + exact fee/bond + fund escrow to claim floor  
5. **Bootstrap five reviewers** (blocker for any human quorum)  
6. Optional: Anthropic / X / Nostr; exercise extension + listing challenge + removal  
7. Remember: no `completed` release until multisig mode  

**Mainnet (later)**  
1. **KEYHOLDERS** + Sparrow map; remove `TEST_ESCROW_ADDRESS`  
2. Mainnet fee in PARAMETERS + secrets/vars  
3. `flip-to-mainnet.sh` + `smoke:mainnet` (`escrow_mode=multisig`)  
4. First allocate + LN smoke + real cosigned release with `decision_id`  

---

## Explicit non-goals for humans right now

- Do not invent KEYHOLDERS xpubs in git without a real ceremony  
- Do not seed bootstrap with throwaway ids (seats are permanent)  
- Do not invent a mainnet fee `bc1…` — paste a real ops wallet address  
- Do not expect Lightning on the default signet deploy  
- Do not set `TEST_ESCROW_ADDRESS` together with descriptor/map (Worker refuses all traffic)  
- Do not expect `outcome: completed` to succeed while `escrow_mode=single-key-test`  
- Do not use `force: true` on real money without a written incident note + `force_note` (mainnet also needs `ALLOW_FORCE_OUTCOME=true`)  
- Do not expect parameter-change ballots — not live by design  
