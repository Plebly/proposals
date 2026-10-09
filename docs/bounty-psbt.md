# How Plebly moves bounty money now

**2026-09-13.** Code is shipped and unit-tested. Signet rehearsal (A2b) has not been run. Live deploy is still `single-key-test`. This is the current-system writeup for the bounty PSBT path. Monthly drip / `direct` is unchanged and out of this document except where the two paths fork.

Living monthly-release doc (older, still true for `direct`): [`system-as-implemented.md`](system-as-implemented.md).  
Signet rehearsal table: [`remaining-human-steps.md`](remaining-human-steps.md) §A2b.  
Mainnet flip: [`mainnet-launch-ops.md`](mainnet-launch-ops.md).

---

## 1. Two money paths (do not mix them)

| | **Bounty** (this document) | **Direct** (untouched) |
|---|---|---|
| Schema | `proposal_type: bounty` only | `proposal_type: direct` |
| Type 1 | Bounty, no milestones → one work output (`psbt_kind: single`) | — |
| Type 2 | Bounty + milestones → one work output per milestone (`psbt_kind: milestone`) | — |
| Funding trigger | Confirmed pot ≥ allocations + reviewer reserve + miner fee | Monthly drip, no structured pot |
| Award | Does **not** wait for the pot | Unchanged |
| Pay | Blocked until structured funding **confirms** | Monthly `outcome: completed` |
| Refund | One pool output (next receive on the escrow descriptor) | Per-donor Q17 packages |
| Payout destination | On-chain address only | On-chain or Lightning |
| Who signs | Humans, Sparrow / hardware | Same for monthly; Worker still auto-broadcasts monthly at threshold |
| Who broadcasts | Humans. Worker never broadcasts a bounty PSBT | Monthly desk still auto-broadcasts at threshold |

`psbt_kind` is frozen at **allocate**. There is no third schema enum.

---

## 2. End-to-end (Type 1 or Type 2)

1. **Merge / allocate.** Worker freezes schema into KV `psbttemplate:{id}`: milestone count, `allocation_sats`, reviewer reserve %, `proposal_type`. After that, an amend that changes those fields is **400**. Type 1 synthesizes one work line (`id: "bounty"`) from `target` or claim floor.
2. **Donors send to the published escrow address.** Funds sit unsplit. Award under `first_bonded` can happen here — **do not wait**.
3. **Structured funding constructs** when confirmed balance ≥ `sum(allocation_sats) + reviewer reserve + estimated miner fee`. Cron and `GET /proposals/:id/structured-funding` both try. Extra addresses are reserved at **construct**, not allocate.
4. **Unsigned structure PSBT:** donation UTXOs → work output(s) + one reviewer-reserve output. Surplus lands on the last work output **by design** — earlier milestones keep their frozen `allocation_sats`; overfunding is not split and is not held in the reviewer reserve. Stored under public R2 prefix `psbtpub/`.
5. **Humans sign and broadcast** the structure tx (Sparrow). Worker does not broadcast.
6. **Confirm:** `POST /proposals/:id/structured-funding/confirm` (hook secret + txid). Worker verifies the tx against the planned outputs, writes `settle_txid` + `outpoint = txid:vout`.
7. **Refund / timelock / reserve_refund construct immediately** after confirm. No award required. Timelock sets `nLockTime` = now + `DELIVERY_WINDOW_DAYS`.
8. **Award** (when it happens) with an on-chain builder address → `clean` + `disputed` construct. Lightning Address / LNURL on bounty apply is rejected.
9. **Challenge window** per work output: `<1M sats = 7d`, `1M–10M = 14d`, `>10M = 30d`. Type 2 requires `allocation_id` when more than one is pending.
   - Expire → select **clean** (skip monthly `completeClaimRelease`).
   - Flag → select **disputed** and still open a `deliverable_confirm` ballot.
10. **Selected branch** is the only one keyholders may sign. Hash-gated: SHA-256 of **raw PSBT bytes** must match the Worker hash.
11. **Partials** store under private `psbtsign/`. At threshold the Worker **combines** and still does **not** broadcast (`broadcast: false` always).
12. **A keyholder downloads the combined PSBT, broadcasts in Sparrow, records the txid.** Dual-ack: the proposer cannot confirm their own settle. `requireConfirmed: true` (signet allows unconfirmed).
13. After **every** work output is `settled`, Worker selects `reserve_refund` (reviewer reserve back to the pool / designated refund path).
14. Ballot **refund** on a frozen bounty template selects pool refund on every unsettled work output **and** the reserve, and skips per-donor Q17 packages.

---

## 3. Branch kinds

| Kind | When it exists | When it is selected | What it pays |
|---|---|---|---|
| `refund` | After structure confirms | Ballot refund, or humans via select | Unspent work → donor **pool** script |
| `timelock` | After structure confirms | Cron when `now >= nLockTime` and selected is not already a terminal pay/refund | Same pool idea after the delivery window |
| `reserve_refund` | After structure confirms (if reserve ≥ miner fee + dust) | Automatically after every work output is `settled` | Reviewer reserve → pool |
| `clean` | After award + on-chain payout | Challenge expire, or `completeClaimRelease` on a frozen template | Builder + 1% BDI + platform fee + 2% keyholder |
| `disputed` | After award + on-chain payout | Challenge flag | 1% penalty → reviewer escrow; rest per dispute outputs |

Sub-dust fee/penalty lines fold into the builder. `BDI_FEE_ADDRESS` / `KEYHOLDER_POOL_ADDRESS` are optional; unset falls back to ops (`resolveFeeAddress`).

`selectBranch` accepts every kind. Clean/disputed may be **selected** during the challenge window before the PSBT bytes exist. Refund/timelock/reserve_refund **fail closed** if not yet constructed.

---

## 4. Who holds what

```
Donors ──► published escrow (primary descriptor / address map)
                │
                │  structure PSBT (unsigned, Worker-built)
                ▼
         work UTXO(s) + reviewer-reserve UTXO
                │
     ┌──────────┼──────────┬─────────────┐
     ▼          ▼          ▼             ▼
  clean      disputed   refund/       reserve_refund
  (builder   (1% to     timelock
   + fees)    reviewer   (pool)
              escrow)
```

- **Primary escrow** — `ESCROW_DESCRIPTOR` + `ESCROW_ADDRESS_MAP`. Donations and work outputs.
- **Reviewer escrow** — `REVIEWER_ESCROW_DESCRIPTOR` + `REVIEWER_ESCROW_ADDRESS_MAP`. Second published descriptor, **same keyholder set**, not a hot wallet. Separate MoneyLocks counter (`reviewer_escrow_next_index`). Half-configured (one var set, the other missing) **fails closed**. Both unset → stand-in (next receive on the primary map, or `single-key-test` reuse).
- **Worker** — constructs unsigned PSBTs, stores hashes, combines partials, verifies settle txids. **Does not hold production spend keys. Does not sign. Does not broadcast bounty PSBTs.**
- **Keyholders** — sign the **selected** branch only, after the SPA hash gate matches. Broadcast in Sparrow.
- **BDI / keyholder fee addresses** — optional dedicated outputs on `clean`. Otherwise ops.

---

## 5. What the Worker never does (bounty path)

- Sign.
- Broadcast (`broadcast: false` on every branch combine).
- Derive addresses from a descriptor (Sparrow-precomputed maps only).
- Accept Lightning on bounty apply.
- Touch `direct-drip.ts`.
- Auto-broadcast a bounty PSBT. `processDueStalls` only selects `clean` after the challenge window from `branch_ready_at`; it does not sign or broadcast. Q21 publicity stall is still `POST /escrow/stall` (hook).

Monthly `/disburse/:id/sign` **still auto-broadcasts at threshold**. That is a different desk. Do not copy that behavior onto branches.

---

## 6. Challenge vs monthly release

On a **frozen bounty template**:

- Window expire → `selectBranch(clean)` and **skip** `completeClaimRelease`.
- `completeClaimRelease` if it still runs → select clean, `skip_release: true` (no monthly coordinated spend).
- Flag → `selectBranch(disputed)` + open `deliverable_confirm`.

On **direct** (no template): monthly `completeClaimRelease` is unchanged.

---

## 7. Hash gate, combine, settle

1. Worker publishes a SHA-256 of the **raw PSBT bytes** (same function as SPA `psbt-hash-gate.ts`).
2. Keyholder desk: Keyholders → **Branches** tab (`/keyholders?tab=branch`). Download / sign only the selected branch.
3. `POST /keyholders/branch-sign/:proposalId/:allocationId` — partial accepted only if hash matches and branch is selected and not already settled.
4. Threshold → `combinePartials` → private `psbtsign/`. **No broadcast.**
5. Human broadcasts in Sparrow.
6. Record txid: `POST /keyholders/branch-sign/.../propose-settle` then a **different** keyholder `.../confirm-settle`, or hook `POST /proposals/:id/branches/:allocationId/confirm`.
7. `verifySettleTx` against the selected branch `decode.outputs`. Settled allocations cannot be re-selected or take more partials.

`branch_ready` stamps `branch_ready_at` (first select or pay-branch construct). `processDueStalls` also requires an open donor review and uses `max(branch_ready_at, opened_at)` + `challengeWindowDays(allocation_sats)`.

---

## 8. Cron and public reads

Cron (after `processDirectDrips`, which is not modified):

- Try structured-funding construct for funded bounties.
- `processDueBranches` — includes `processDueTimelocks` (select `timelock` when locktime is due and selected is not already clean/disputed/refund/timelock / settle_proposed / settled).
- `processDueStalls` — requires an open donor review (mark done). Clock is `max(branch_ready_at, opened_at) + 7/14/30d`. Then `selectBranch(clean)` if selected is not already clean/disputed/refund/timelock/reserve_refund / settled. Skips `completeClaimRelease`. Does not broadcast. Cron pages every `psbttemplate:` key.
- After all work outputs settled → `maybeSelectReserveRefund`.

Public:

- `GET /proposals/:id/structured-funding` — unsigned structure PSBT + hash (`psbtpub/`).
- `GET /proposals/:id/branches` — unsigned branch PSBTs + hashes (`psbtpub/`).
- `getClaimStatus` → `psbt` snapshot only: kind, structured state, selected branch, signoff counts. **No bytes.**

Signed partials and the combined PSBT stay under private `psbtsign/`. Combine fail-closes without the MEDIA binding (503). Cron pages every `psbttemplate:` key.

Next-action sentences: pot pooling / structured ready / “Settled on-chain.” Direct keeps monthly sentences.

R2: `psbtpub/` is a public prefix. `disburse/`, `receipts/`, `psbtsign/` stay blocked.

---

## 9. Parameters (do not silently change)

From `proposals/parameters.json` (Worker generated copy):

| Key | Current | Notes |
|---|---|---|
| `bdi_fee_percent` | **1** | Clean builder path |
| `platform_fee_percent` | **3** | Public TOS / About / UI. Not 2% — 2% is keyholders |
| `reviewer_reserve_percent` | **2** | Implementer-chosen; freeze at allocate |
| Keyholder take on clean | **2** (`keyholder_fee_percent`) | From `parameters.json`, not a branch-file constant |

Miner fee estimate: `11 + nIn*150 + nOut*43` vB × 10 sat/vB.

TOS version `tos-2026-09-13`: Worker does not hold signing keys and does not sign. Constructs unsigned PSBTs for keyholder review.

---

## 10. What CI proves vs what it does not

**CI (mocked mempool / KV / R2):** freeze + amend lock, LN reject on bounty apply, Type 1/2 structure + four branches, refund-only then pay-upgrade, Type 2 surplus on last work output only, challenge 7/14/30 (Worker + SPA), template expire skips monthly, flag/tally select, reviewer map isolated index, half-set reviewer escrow fails closed, hash mismatch reject, dual-ack settle, hook secret + hook settle (never broadcasts), reserve waits for every work settle, timelock after `nLockTime`, ballot refund selects donor-pool branches, stall clock 7/14/30 from `branch_ready_at` selects clean (skips flagged / auto_completed; no override of disputed/refund), dust-aware fee fold-in, confirm rejects missing PSBT or mismatched tx, cron lists every `psbttemplate:` (paginated) and runs structured → branches → stalls, MEDIA 503 on partials, public branches include unsigned bytes but never `psbtsign` / combined R2 keys, claim status includes `psbt` without bytes, Worker ↔ SPA SHA-256 lock on raw PSBT bytes, early `clean` select binds hash after construct, mempool UTXO list is confirmed-only, SPA structured-funding panel hash-gates and never offers broadcast.

**Not proven:** real Sparrow/hardware partial → combine → broadcast → confirmed settle on signet. That is A2b. Until A2b, this is not a validated money path.

---

## 11. Code map

| Piece | Where |
|---|---|
| Schema freeze | `workers/src/lib/psbt-template.ts`, allocate in `escrow-allocate.ts`, amend lock in `routes/proposals.ts` |
| Structured funding | `workers/src/lib/structured-funding.ts` |
| Branches | `workers/src/lib/psbt-branches.ts` |
| Hash-gated sign / combine / settle | `workers/src/lib/psbt-branch-sign.ts` |
| Challenge / stall clock | `workers/src/lib/donor-review.ts`, `challenge-window.ts`, `processDueStalls` |
| Claim / skip monthly | `workers/src/lib/builder-claim.ts`, `claim-complete.ts` |
| Ballot refund fork | `workers/src/lib/ballots.ts` |
| Reviewer descriptor | `workers/src/lib/escrow-mode.ts`, MoneyLocks `reviewer_escrow_next_index` |
| SPA hash gate + Branches tab | `plebly.fund/src/psbt-hash-gate.ts`, `keyholders-page.ts` |
| Next-action / apply wizard | `plebly.fund/src/next-action.ts`, `builder.ts` (`ClaimStatus.psbt`) |

Security boundary: Worker coordinates. Production spend keys stay on keyholder devices. Bounty combine never sets `broadcast: true`.
