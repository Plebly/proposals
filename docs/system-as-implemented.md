# Plebly — system as implemented

**Status:** living description of the running system (not a wishlist).  
**Date:** 2026-07-25  
**Network (deployed):** Bitcoin **signet**  
**API:** https://plebly-api.securesovereigns.workers.dev (`plebly-api` v0.4.0)  
**Site:** https://plebly.fund  

Related docs: `PARAMETERS.md` / `KEYHOLDERS.md` / `TESTING.md` in [Plebly/proposals](https://github.com/Plebly/proposals); design history in this folder (`open-questions-resolved.md`, `implementation-plan.md`, `plebly-technical-infrastructure-v4.md`).

---

## 1. Purpose and trust model

Plebly is a **public funding surface for Bitcoin work**: proposals live in git, sats sit at **on-chain escrow addresses**, builders claim exclusivity with a bond, and reviewers / keyholders execute outcomes under published rules.

**What the platform does**

- Host the site and Workers API (auth, claims, fees, Lightning claimer, ballots).
- Open GitHub PRs into `Plebly/proposals` (GitHub App).
- Verify fees/bonds and escrow balances via public mempool APIs.
- Index contributions and enforce claim-abuse / funding-window rules in KV + cron.

**What the platform does not do**

- Hold production multisig keys or auto-spend escrow (Workers never sign releases).
- Replace git as the canonical proposal record.
- Confiscate unclaimed refunds or take a fee on refunds (Q17).

**Residual trust (v1):** 3-of-5 keyholders can stall after reviewer approval; there is no on-chain timelock. Ops runbook + site stall banner (`/escrow/stall`). Documented in PARAMETERS (Q21).

---

## 2. Repository layout

Three git repos (no monorepo):

| Path | Repo | Role |
|------|------|------|
| `workers/` | [Plebly/workers](https://github.com/Plebly/workers) | Cloudflare Worker API + cron |
| `plebly.fund/` | [Plebly/plebly.fund](https://github.com/Plebly/plebly.fund) | Static SPA (Vite → GitHub Pages) |
| `proposals/` | [Plebly/proposals](https://github.com/Plebly/proposals) | Canonical proposals, schema, CI, parameters |
| `docs/` | *(local / not a git root)* | Design + this document |

Proposal markdown lives under `proposals/proposals/{unindexed,listed,claimed,completed,declined}/`.

---

## 3. High-level architecture

```mermaid
flowchart TB
  User[Browser plebly.fund]
  API[Cloudflare Worker plebly-api]
  GH[GitHub Plebly/proposals]
  MP[Mempool API signet/mainnet]
  BZ[Boltz API LN]
  KV[(KV: USERS CONTRIBUTIONS SESSIONS SWAPS)]
  R2[(R2: MEDIA)]

  User -->|OAuth session Bearer / cookie| API
  User -->|raw + Contents API list| GH
  User -->|address balances| MP
  API -->|GitHub App PRs| GH
  API -->|fee/bond/escrow verify| MP
  API -->|reverse swaps| BZ
  API --> KV
  API --> R2
  Cron[Worker cron every minute] --> API
```

**Data authority**

| Concern | Source of truth |
|---------|-----------------|
| Proposal text + status | Git on `main` in `Plebly/proposals` |
| Balances / fee txs | Bitcoin chain via mempool.space |
| Sessions, ledgers, pending claims, ballots | Worker KV |
| Covers | R2 |

---

## 4. Runtime configuration (deployed)

### Workers (`workers/wrangler.toml`)

| Binding / var | Value / meaning |
|---------------|-----------------|
| `BITCOIN_NETWORK` | `signet` |
| `MEMPOOL_API` | `https://mempool.space/signet/api` |
| `PROPOSALS_REPO` | `Plebly/proposals` |
| `FRONTEND_ORIGIN` | `https://plebly.fund` |
| `TEST_ESCROW_ADDRESS` | Shared signet receive (smoke / test) |
| `TEST_SUBMISSION_FEE_ADDRESS` | Fee/bond receive on signet |
| KV | `USERS`, `CONTRIBUTIONS`, `SESSIONS`, `SWAPS` |
| R2 | `MEDIA` → `plebly-media` |
| Cron | `* * * * *` |

**Secrets / vars (not all in git):** `SESSION_SECRET`, `HOOK_SECRET`, GitHub OAuth + App, `X_CLIENT_ID` / `X_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `AI_REVIEW_MODEL`, `AI_REVIEW_PROMPT_VERSION`, `BOOTSTRAP_REVIEWERS`, mainnet `SUBMISSION_FEE_ADDRESS` / `ESCROW_DESCRIPTOR` / `ESCROW_ADDRESS_MAP`.

### Frontend (`plebly.fund/src/config.ts` + Pages CI)

- `VITE_WORKERS_API` → Workers URL above  
- `VITE_BITCOIN_NETWORK=signet`  
- Proposals loaded from GitHub raw + Contents API  

---

## 5. Authentication and authorization

### End-user session

1. **GitHub OAuth** (`GET /auth/github` → callback) creates session user `github:{id}`.
2. **X OAuth 2.0 + PKCE** (`GET /auth/x` → `/auth/x/callback`) creates session user `x:{id}` (confidential client; Basic auth on token exchange). Requires `X_CLIENT_ID` / `X_CLIENT_SECRET`; 501 if unset.
3. **Nostr** (`/auth/nostr/challenge` + `POST /auth/nostr`) creates `nostr:{pubkey}`.
4. Session is a **JWT** (HS256, 7d) signed with `SESSION_SECRET` (`lib/session.ts`).
5. Delivered as `HttpOnly` cookie and/or `Authorization: Bearer` (hash handoff `#plebly_auth=` for cross-origin).
6. Profile stored at `user:{userId}`; optional public username `uname:{username}` → `/u/{username}`.

### Ops hooks (`HOOK_SECRET`)

Header: `X-Plebly-Hook-Secret`. **Must not** reuse `SESSION_SECRET`. Fails closed if unset.

Used for: `/escrow/allocate`, `/escrow/stall`, `/claims/outcome`, `/claims/challenge/accept`, `/claims/bonds/refundable`, `/ballots/open`, `/ballots/:id/tally`, `/refunds/proposal/:id`, `/reviewers/bootstrap`, `/reviewers/decisions/open`, `/reviewers/decisions/:id/tally`, `/reviewers/removals/:id/tally`.

### GitHub App

Installation token opens PRs into `Plebly/proposals` (propose, **amend**, claim, reopen, allocate patch, ballots, deliverables, dissent, rebuttal, AI fail notes). Requires Pull requests (+ Issues for PR comments).

---

## 6. Proposal lifecycle

### Status vocabulary (schema)

`pr_open` → `unindexed` → `listed` | `declined` | `declined_fundable` → `funding` / `claimable` → `claimed` → `in_review` → `completed` | `rejected`  

Also: `underfunded`, `abandoned_vote`, `refunding`, `redirected`.

### Folders (on disk)

```
proposals/proposals/
  unindexed/   # after site/direct PR merge path
  listed/      # fundable (demo smoke bounty lives here)
  claimed/
  completed/
  declined/
```

**Worker claimable set:** `listed` | `funding` | `claimable`  
**Taken set:** `claimed` | `in_review` | `rejected`

### Site propose (create)

`POST /proposals/submit` (session) — SPA `/propose`:

1. Exact **10k** submission fee to fee address (`verifyExactPayment`, mark `paytxid:`).
2. Optional cover must already exist in R2.
3. Author fields: title, problem, deliverable, verification, out of scope, optional notes, optional `target_sats`, milestones, `depends_on`, `related_work`.
4. `target_sats ≥ 1M` requires ≥1 milestone (Q12).
5. Stamps `proposer: { github, username, nostr, x }` from profile.
6. Opens PR into `proposals/unindexed/…` (**branch only until merge** — not editable in-app while `pr_open`).

### Site amend (edit)

`POST /proposals/update` (session) — SPA `/propose?edit={repoPath}` or **Edit proposal** on the project page:

1. File must exist on **`main`** (`fetchProposalRaw`).
2. Status ∈ `unindexed` | `listed` | `funding` | `underfunded` | `claimable` | `declined_fundable` (pre-claim only).
3. Session must match frontmatter `proposer` (username | github | x | nostr).
4. No second submission fee. Opens `amend/*` PR via `openProposalUpdatePullRequest`, preserving lifecycle fields (status, escrow_*, fee txid, claimer, windows, `proposer`, `created_at`, `id`).
5. Concurrent amends are allowed (same pattern as other update PRs); merge/close stale amend PRs in review.

Worker frontmatter parse/serialize supports nested YAML (`lib/yaml-fm.ts`) so listed files with multi-line `proposer` / `milestones` round-trip correctly.

### Proposal dependency fields (frontmatter)

| Field | Meaning |
|-------|---------|
| `depends_on[]` | **Blocking** deps: `{ kind: plebly\|external, label, ref?, note? }` — other initiatives this work needs |
| `related_work[]` | **Non-blocking** prior art: `{ label, url (https), note? }` |
| `milestones[].dependencies` | Q11: prior **milestone ids** in the same file (`m1`, …) |

Schema: `proposals/schema/proposal.schema.json`. Template defaults empty arrays.

### Escrow allocate (hook)

`POST /escrow/allocate` `{ proposal_id, status: listed|declined_fundable, patch_proposal? }`:

| Network | Behavior |
|---------|----------|
| **Signet** | Returns `TEST_ESCROW_ADDRESS`, index `0`, writes `escrow_allocated_at` + `funding_window_ends_at` (+180d); optional PR patch (default on) |
| **Mainnet** | Requires `ESCROW_DESCRIPTOR` + address in `ESCROW_ADDRESS_MAP` for next `escrow:next_index`; else **501** |

Does not derive addresses in-Worker from the descriptor yet — Sparrow-precomputed map is the writer companion to KV index.

---

## 7. Funding and donations

### On-chain

- Escrow address in proposal frontmatter.
- Site shows **confirmed** address balance (mempool).
- Claim floor: **100,000 sats** confirmed.
- Funding bar: green to floor; overfund styling beyond floor.
- Optional `target_sats` is display-only for claim eligibility.

### Lightning (Boltz reverse swap)

- Enabled automatically on mainnet/testnet; **off on signet** unless `LIGHTNING_ENABLED=true`.
- UI gated by `lightningUiAllowed()` (signet hidden unless Vite flags).
- `POST /lightning/invoice` verifies proposal escrow, creates reverse swap, stores encrypted secrets in `SWAPS`.
- Cron claimer broadcasts claim into escrow; floor still uses on-chain confirmed balance only.
- Mainnet prefers confirmed lockup before claim broadcast; signet allows mempool claim for speed.
- Contributions upgraded to confirmed at **≥3** confs (`FUNDING_CONFIRMATIONS`).

### Contribution index

KV key **`contrib:{proposalId}`** only (canonical).

Entry shape (conceptual):

```json
{
  "txid": "...", "vout": 0,
  "swap_id": "...",
  "amount_sats": 21000,
  "confirmed": true,
  "confirmations": 3,
  "user_id": "github:…",
  "identity": "…",
  "rail": "onchain|lightning",
  "refund_address": "…"
}
```

- Cron indexes watched escrow addresses (`escrowwatch:index`).
- `POST /contributions/record` — verify outpoint pays escrow.
- `POST /contributions/claim` — bind outpoint/swap to session (required for strict challenge / 1p1v).

---

## 8. Builder claims (critical path)

### Product rules (enforced)

1. **Site slot** = pending KV + `registerActiveClaim` / `claimactive:` when claim PR opens (not at merge).
2. **90-day window** starts when `claimed_at` is set from claim PR **`merged_at`** only (cron `syncClaimAcceptedAt`).
3. Bond/fee **spent at verify** (`paytxid:`) — burned even if PR never merges.

### Open claim (`POST /claims/`)

1. Session; not suspended; max **1** active claim; reclaim cooldown; global **10** site claims/day.
2. Exact bond (10k or 2× after abuse threshold) to fee address.
3. Confirmed escrow ≥ claim floor; status open.
4. Milestones grace: if balance ≥ 1M, empty milestones, and `milestones_due_at` passed → reject.
5. CAS pending `claim:{id}` (TTL **72h**).
6. Mark bond spent; open PR → `status: claimed`, `claim_opened_at`, `claimed_at: null`, path toward `proposals/claimed/`.
7. Set `claimactive:{id}`, `claimowner:{id}`, ledger bond `locked`.

### Checkpoint

- Due day **45** from `claimed_at`, grace **+7** days.
- `POST /claims/checkpoint` — HTTPS only, SSRF blocklist, required HEAD/GET 2xx/3xx; stores `checked_at`.

### Cron enforcement (`processBuilderClaimLifecycle`)

- Sync `claimed_at` from merged PR.
- Past window → `expired`, forfeit bond, reopen.
- Missed checkpoint after grace (while `claimed`) → `abandoned`, forfeit, reopen.
- **GET `/claims/:id`** only syncs accept timestamp (backup); does not own reopen side-effects.

### Reopen guards (`openClaimReopenPullRequest`)

| Situation | Action |
|-----------|--------|
| Open unmerged claim PR | Comment + close; clear KV; **no** move PR |
| Status `in_review` | Set `claimreopen_needs_human:`; no auto PR |
| Taken on main | PR to `listed/` + `claimable`, clear exclusivity fields; never auto-merge |
| Dedupe | `claimreopen:{id}` TTL 30d |

### Outcomes

- Hook `POST /claims/outcome` `{ proposal_id, completed|rejected, final? }` — owner from `claimowner:` or durable `claimfulfiller:`.
- Completed → bond `refundable` + ops index + **earned reviewer seat**; rejected/expired/abandoned → cooldown 30d.
- First rejection opens a **14-day rebuttal window** (`rebuttal:`). `final: true` or second-review reject closes without further appeal.
- **Blocked** with 409 while rebuttal status is `pending` / `second_review`.
- Challenge: contributor opens PR; hook `POST /claims/challenge/accept` forfeits + reopen.

### Delete account

Removes profile, username, watches, pending-user index; **retains** `claimledger:{userId}` tombstone. Orphan `claimowner:` / `claimactive:` cleared by lifecycle cron.

---

## 8b. Reviewers, AI triage, dissent, rebuttal, removal

### Reviewer set (KV)

| Key | Meaning |
|-----|---------|
| `reviewer:{userId}` | `{ kind: bootstrap\|earned, status: active\|removed, completed_proposal_ids, … }` |
| `reviewer:index` | Active reviewer user ids |
| `reviewer:completions` | Platform completion counter (ten-bounty bootstrap threshold) |
| `reviewer:completion:{proposalId}` | Idempotent completion bump |

- **Bootstrap:** exactly five seats via hook `POST /reviewers/bootstrap` (body `user_ids` or env `BOOTSTRAP_REVIEWERS`). Seats retained permanently.
- **Earned:** automatic on `POST /claims/outcome` → `completed` (`addEarnedReviewer`). After ten platform completions, earning is still via completions only (no new bootstrap path).
- Removed reviewers may re-earn via a later completion.

### Decision quorum (`lib/review-quorum.ts`)

```
need_yes = ceil(2/3 * roster)
pass iff yes >= need_yes AND (yes + no) >= 5 AND yes > 0
```

Non-responses are abstentions. Abstentions never satisfy `need_yes`. Bootstrap roster 5 ⇒ need 4 yes and all five non-abstaining.

Routes: `/reviewers/decisions/*` (open/vote/tally/dissent). KV: `revdec:`, `revdecopen:`.

### AI first-pass (on deliverable submit)

- Prompt: `proposals/review-prompts/{AI_REVIEW_PROMPT_VERSION}.md` (default `v1`).
- Model: `AI_REVIEW_MODEL` (default `claude-sonnet-4-20250514`) via Anthropic Messages API in-Worker (`ANTHROPIC_API_KEY`).
- Inputs: `verification_method` / `acceptance_criteria` (frontmatter or `## Verification` / `## Acceptance criteria` body sections) + deliverable.
- **pass** → status `in_review` + open reviewer decision ballot with AI attached (never releases funds alone).
- **fail** → revert/stay `claimed`, PR notes failing criteria, **no** ballot.
- **ambiguous** / API down → ballot with AI reasoning (`ai-unavailable` style fallback).

### Dissent

Any active reviewer: `POST /reviewers/decisions/:id/dissent` → GitHub App PR appending `## Dissent` on the proposal file (permanent git record).

### Rebuttal

- `POST /claims/rebuttal` (session, fulfiller, within 14 days) → PR `## Rebuttal` + open `second_review` decision (round 2).
- Second reject is final (`final` outcome / resolve rebuttal). No third appeal.

### Reviewer removal (funders)

- Eligible: identity-linked contribution with ≥3 confs **and ≥10,000 sats** to any watched escrow in prior 12 months (`contrib.ts` + `escrowwatch:index`).
- Vote: ⅔ of votes cast; quorum ≥5 participating (or all eligible if &lt;5).
- Bootstrap seats **cannot** be removed. Target cannot vote on their own ballot. **30-day cooldown** after any tally against a target.
- Routes: `/reviewers/removals/*` (list open via `GET /reviewers/removals`). KV: `revremove:`, `revremoveopen:`, `revremove:openindex`, `revremovecd:`.

### Abuse / gaming mitigations (resolution layer)

| Vector | Mitigation |
|--------|------------|
| Stack bootstrap cohorts via hook | Seed rejects once 5 bootstrap seats exist (unless identical reseed) |
| Remove bootstrap via funder vote | `kind: bootstrap` seats cannot be removed |
| Fulfiller votes own deliverable | Vote + tally exclude `claimfulfiller` |
| Complete without reviewer approve | `/claims/outcome` completed requires tallied approve (`force:true` ops escape) |
| Reset 14d rebuttal clock | `openRebuttalWindow` does not overwrite open/pending/resolved state |
| Dissent PR spam | 1 dissent per reviewer per decision |
| Dust-sybil removal votes | ≥10k sats confirmed contribution required |
| Removal ballot spam | 30d cooldown per target after tally |
| AI / deliverable DoS | 5 submissions/day/proposal; block while decision open |
| Prompt path traversal | `AI_REVIEW_PROMPT_VERSION` sanitized to safe filename |

Residual: HOOK_SECRET holders can still `force` complete / open decisions (ops trust). Sybil earned reviewers still cost a real `completed` bounty.

---

## 9. Fees and anti-replay

Implemented in `workers/src/lib/fee-payment.ts`.

| Rule | Signet | Mainnet |
|------|--------|---------|
| Exact sats to fee address | Required | Required |
| Confirmation | Unconfirmed OK | Must be confirmed |
| Address missing | Fail closed | Fail closed |
| Replay | `paytxid:{txid}` (+ legacy `bondtxid:`) | Same |

Purposes: `submission_fee` | `claim_bond` (cross-purpose: one txid cannot pay both).

CI: `proposals/scripts/check-fee-payments.mjs` on PRs when `vars.SUBMISSION_FEE_ADDRESS` is set (warns + skips if unset — **branch protection must require the Completeness check** or direct-git bypasses).

---

## 10. Funding windows, milestones, ballots, refunds

### Funding window (Q5)

- Frontmatter: `escrow_allocated_at`, `funding_window_ends_at` (180d).
- Cron: window ended and balance &lt; floor → PR status `underfunded`.
- UI: days-remaining banner on project page.

### Milestones (Q12)

- Listing/submit: `target_sats ≥ 1M` requires milestones (schema + Worker).
- Mid-flight: balance ≥ 1M and empty milestones → PR sets `milestones_due_at` (+30d).
- After grace: claim create + outcome hooks blocked; site banner.

### Ballots (Q18 / Q54)

- Idle **365d** claimable → open ballot + status `abandoned_vote`.
- Options: `extend` | `refund` | `redirect:<proposal_id>` (≤3 noms).
- Voting: one identity-linked contributor with **≥3 confs** = one vote.
- Tally (hook): plurality; quorum = majority of distinct contributors (or all if &lt;3).
- Decision artifact PR under `decisions/`.

### Refunds (Q17)

- Contributors register refund address on indexed outpoint (`POST /refunds/register`).
- Ops list via hook. Dust / batch rules are policy for keyholders; **no platform fee** on refunds.
- Automated batch payouts are **not** Worker-implemented.

### Keyholder stall (Q21)

- Hook sets KV `release_blocked:{id}`; site banner.
- Runbook: `proposals/docs/keyholder-stall-runbook.md`.

---

## 11. Frontend surface

SPA routes (`plebly.fund/src/router.ts`):

| Path | Behavior |
|------|----------|
| `/` | Listed/claimed/completed cards; balances from mempool |
| `/propose` | Create: fee-pay + narrative + milestones + depends_on + related_work |
| `/propose?edit={path}` | Amend prefill (on-main, pre-claim, proposer only) → `POST /proposals/update` |
| `/proposal/{status}/{slug}` | Detail: byline, **Edit** CTA when eligible, depends_on / related_work, milestones rail (+ intra-deps), funding bar, build/donate, **reviewer decision** (in_review), **rebuttal** (rejected), ballots/refunds |
| `/reviewers` | Governance: roster, open decisions, removal ballots (funder vote / open) |
| `/u/:username` | Public profile (+ reviewer badge when seated) |
| `/account` | Profile, watching, claims (+ history), proposals; reviewer / funder links |
| `/about` | Beliefs, parameters, residual trust |

Login: nav **Log in** menu offers **GitHub** and **X** (Nostr also available via API/auth routes). Deliverable submit shows **AI first-pass** card inline. **Reviewers** lives in the footer and on About (not top nav).

Proposals are **read from GitHub `main`**; create/amend/claim/lifecycle mutations go through Workers → PRs. Nested frontmatter parsed in `src/frontmatter.ts` (SPA) and `workers/src/lib/yaml-fm.ts` (API).

---

## 12. Worker API catalog (summary)

| Auth | Routes |
|------|--------|
| Public | `/health`, proposal claim status, contrib list, LN status/swap poll, ballot get, stall get, media get, public profile, reviewer roster / open decisions / open removals / decision get |
| Session | **propose submit + amend**, claim, checkpoint, challenge open, rebuttal, watch, profile CRUD, contrib claim, ballot vote, refund register, media upload, deliverable, reviewer vote/dissent, removal open/vote |
| HOOK_SECRET | allocate, stall, outcome, challenge accept, refundable bonds, ballot open/tally, refunds list, reviewer bootstrap, decision open/tally, removal tally |

Cron (every minute): LN claimer → builder claim lifecycle → LN contrib conf upgrade → escrow contrib index → funding windows / milestones / idle ballots.

---

## 13. KV / R2 key patterns (operational)

**USERS:** `user:`, `uname:`, `watch:`, `paytxid:`, `bondtxid:`, `claim:`, `claimpendinguser:`, `claimactive:` + `claimactive:index`, `claimowner:`, `claimfulfiller:`, `claimledger:`, `claimrate:`, `claimchallenge:`, `claimreopen:`, `claimreopen_needs_human:`, `bondrefundable:index`, `escrow:next_index`, `escrowwatch:index`, `release_blocked:`, `ballot:`, `ballotopen:`, `mediaupload:`, `reviewer:` + `reviewer:index` + `reviewer:completions`, `revdec:` + `revdecopen:` + `revdec:index`, `rebuttal:`, `revremove:` + `revremoveopen:` + `revremove:openindex` + `revremovecd:`, `xoauth:` (SESSIONS)

**CONTRIBUTIONS:** `contrib:{proposalId}`  

**SESSIONS:** Nostr challenges only (`nostr:chal:`) — JWTs are not stored in KV  

**SWAPS:** `lnswap:`, `lnswap:index`, `lnclaimlock:`  

**R2:** `covers/{userId}/{uuid}.{ext}`  

---

## 14. Live parameters (code + PARAMETERS.md)

| Parameter | Live value |
|-----------|------------|
| Submission fee / claim bond | 10,000 sats exact |
| Claim floor | 100,000 sats confirmed |
| Claim window | 90 days from `claimed_at` |
| Checkpoint | day 45 + 7d grace |
| Pending TTL | 72 hours |
| Reclaim cooldown | 30 days |
| Max active claims | 1 |
| Site claim PRs / day | 10 |
| Abuse escalation | 2 failures → 2× bond |
| Milestone threshold | 1,000,000 sats |
| Funding window | 180 days from allocate |
| Idle → ballot | 365 days |
| Vote / funding confirmations | 3 |
| Platform fee | 2.5% at successful disbursement (policy; not auto-taken by Worker) |
| Reviewer quorum | ⌈⅔ roster⌉ yes + ≥5 non-abstain |
| Bootstrap seats / threshold | 5 seats / 10 completions |
| Rebuttal window | 14 days |
| Review decision ballot | 14 days |
| AI prompt / model | `v1` / `claude-sonnet-4-20250514` (env-overridable) |
| Network | **signet** |

---

## 15. Testing

| Tier | Command | Risk |
|------|---------|------|
| Workers unit/HTTP (mocked) | `cd workers && npm test` | None (~166 tests) |
| Frontend unit | `cd plebly.fund && npm test` | None (~35 tests) |
| Proposal schema + fee helpers | `cd proposals && npm run validate:all && npm test` | None |
| Live read-only smoke | `cd workers && npm run smoke:signet` | None |
| Opt-in spend | Manual Sparrow on **your** signet addresses | Signet sats |

Coverage emphasis: HOOK_SECRET, fee anti-replay, claim pending/active/lifecycle, contrib identity, ballots, FUNDABLE, checkpoint SSRF, ledger retention, escrow allocate, reviewer quorum math, AI triage fallback, rebuttal outcome block, X OAuth PKCE, funder removal eligibility, resolution abuse, nested FM round-trip, proposal amend auth/status gates, depends_on / related_work validation.

---

## 16. Explicit gaps / TBD (do not assume done)

| Gap | Notes |
|-----|-------|
| KEYHOLDERS production xpubs / descriptor | `KEYHOLDERS.md` TBD; mainnet allocate 501 |
| Mainnet fee address in PARAMETERS | Still `TBD`; use env + CI repo var |
| Descriptor → address derivation in Worker | Uses `ESCROW_ADDRESS_MAP` JSON, not online derive |
| Multisig release automation | Human keyholders + runbooks |
| Bootstrap reviewer identities | Seed via `/reviewers/bootstrap` + publish in `REVIEWERS.md` |
| Anthropic key in production | Set `ANTHROPIC_API_KEY`; without it AI → ambiguous |
| X OAuth credentials | Wired; needs portal app + secrets |
| Lightning on default signet deploy | Off |
| Ops suspend of other users | Self-only today |
| Automated refund batching | Register only |
| Branch-protection on Completeness | Required ops step or fee CI is skippable |

---

## 17. Typical end-to-end paths (as built)

### A. List and fund a bounty (signet)

1. Pay 10k fee → submit on site (milestones / depends_on / related_work as needed) → PR to `unindexed/` → merge to `main`.
2. After merge, proposer may **Edit** in-app (amend PR) while pre-claim.
3. Hook allocate (or manual FM) sets address + funding window → `listed` / funding.
4. Donors send signet sats (and/or LN if enabled); balance updates on site.
5. At ≥100k confirmed, project is open to claim.

### B. Claim and deliver

1. Builder pays bond → site opens claim PR → slot held in KV.
2. Reviewer merges → cron sets `claimed_at` from `merged_at`.
3. Checkpoint by day 45 (+grace); deliverable submit → AI first-pass → reviewer ballot (unless clear fail) → hook outcome.
4. Hook outcome `completed` → bond refundable + earned reviewer seat.

### C. Failure / abandon

1. Window or checkpoint miss → cron forfeits bond, reopen to `claimable`.
2. Or contributor challenge → accept hook → same reopen path.
3. Idle 365d / underfunded window → ballot → extend / refund / redirect.

---

## 18. File map (implementation entrypoints)

| Area | Primary paths |
|------|----------------|
| Worker entry + cron | `workers/src/index.ts` |
| Fee/bond | `workers/src/lib/fee-payment.ts` |
| Claims | `workers/src/lib/builder-claim.ts`, `claim-lifecycle.ts`, `claim-abuse.ts`, `routes/claims.ts` |
| Reviewers / decisions | `lib/reviewers.ts`, `lib/review-decisions.ts`, `lib/review-quorum.ts`, `lib/ai-review.ts`, `lib/rebuttal.ts`, `lib/reviewer-removal.ts`, `routes/reviewers.ts` |
| Contrib / ballots / refunds | `lib/contrib.ts`, `lib/ballots.ts`, `routes/contributions.ts`, `routes/ballots.ts`, `routes/refunds.ts` |
| Escrow | `lib/escrow-allocate.ts`, `routes/escrow.ts` |
| LN | `lib/claimer.ts`, `lib/boltz.ts`, `routes/lightning.ts` |
| Auth | `routes/auth.ts` (GitHub, X PKCE, Nostr) |
| Propose / amend | `workers/src/routes/proposals.ts`, `lib/yaml-fm.ts`, `lib/proposal-deps.ts`, `lib/proposer-match.ts` |
| Frontend | `plebly.fund/src/{main,router,propose-page,propose-milestones,propose-deps,proposal-page,proposal-ui,builder-panel,review-panel,governance-page,reviewers,fee-pay,github,frontmatter}.ts` |
| Schema / CI | `proposals/schema/proposal.schema.json`, `template/proposal.md`, `.github/workflows/completeness.yml` |
| AI prompts | `proposals/review-prompts/v1.md` |
| Parameters | `proposals/PARAMETERS.md`, `proposals/REVIEWERS.md`, `workers/src/lib/claim-params.ts`, `reviewer-params.ts` |

---

*End of as-implemented description. When behavior changes, update this file in the same PR as the code.*
