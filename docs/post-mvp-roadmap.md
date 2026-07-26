# Plebly — Post-MVP Roadmap

**Status:** living engineering roadmap (implementation in progress)
**Date:** 2026-07-25
**Source ideas:** review against MVP as built on signet

Related: [`system-as-implemented.md`](system-as-implemented.md), [`remaining-human-steps.md`](remaining-human-steps.md). Stale pre-MVP wishlist: [`implementation-plan.md`](implementation-plan.md).

---

## Decided defaults (`proposal_type`)

| Question | Decision |
|----------|----------|
| Milestones above 1M sats | Same for `bounty` and `direct` |
| Windows for `direct` | Funding window + **delivery window** (no claim window / bond) |
| Review path for `direct` | Same AI + human reviewer quorum (no lighter path in v1) |
| Missing `proposal_type` | Defaults to `bounty` |

---

## 1. Proposal types (schema — first)

- **`bounty`** — open claim, bond, claim window, checkpoint (current MVP).
- **`direct`** — proposer is recipient; no claim step; proposer submits deliverable into the same escrow + review release path.

## 2. Unified event and announcement system

Events: `listed`, `floor_reached`, `target_reached`, `claimed`, `deliverable_submitted`, `completed`.

Fans out to: Nostr feed, in-app notifications, optional homepage activity.

## 3. Foundation hardening

Tags, search/filter, stats page, fund-the-gap ticker, comments + evaluating, public funder credit, recurring/earmarked funding (later), About trust model (plain language).

## 4. Homepage and discovery

Featured / Recently Completed / Browse rails; view counter for featured score.

## 5. SEO

Stable ID URLs (`/p/{id}`), prerender/OG, structured data, sitemap. Fix folder-based URL breakage.

## 6. Integrations

- **Done:** GitHub Action (`proposals/.github/workflows/issue-to-proposal.yml`) — label `plebly-proposal` or `plebly` → draft PR under `proposals/unindexed/`.
- **Done:** Embeddable funding widget — Worker `GET /embed/:proposalId` + `plebly.fund/public/embed.js` (docs: [`embed.md`](embed.md)).
- Remaining: Nostr (via §2).

## 7. AI-native layer

Draft assist, submission first-pass, skills profiles, matching, template library.

## 8. Ops roles (planned)

Public read hooks may expose bootstrap role labels, but no role can grant authority to move funds, sign transactions, or change parameters. Grant/retain votes and term limits remain gated until the reviewer pool is meaningful.

## 9. Governance, later (volume-gated)

Commons / parent-initiative is informational proposal metadata. Community parameter voting is not live; any ballot system requires published eligibility, quorum, and activation rules.

## 10. Recurring funding (not shipped)

Funding remains one-time escrow in the MVP. Recurring and earmarked funding need separate accounting, cancellation, and contributor-consent rules before implementation.

---

## Build order

0. Docs + About trust  
1. `proposal_type`  
2. Stable URLs  
3. Events + Nostr + notifications  
4. Tags / search  
5. Homepage rails + stats + gap ticker  
6. Comments / evaluating / funder credit  
7. ~~GitHub Action + widget~~ (done — Nostr still open under §2/§6)  
8. AI layer  
9. Recurring funding and community governance activation  
