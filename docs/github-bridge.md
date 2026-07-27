# Cross-repo GitHub bridge

Install the **Plebly** GitHub App on any repository to turn an issue into a Plebly bounty draft, then complete the fee + listing on [plebly.fund](https://plebly.fund).

## Maintainer flow

1. Install the App on `your-org/your-repo` (and keep it installed on `Plebly/proposals`).
2. Create labels `plebly` and/or `plebly-proposal` (or comment `/plebly` on an issue).
3. Label an issue → App opens a **draft** PR under `proposals/unindexed/bridge-…md` and comments a deep-link.
4. Open the link → pay **10,000 sats** submission fee → finish Deliverable / Verification / Out of scope → submit.
5. Worker updates the **same draft branch** (no second PR) and marks the PR ready.
6. After Completeness CI + merge + escrow allocate, the source issue gets escrow address, `/p/{id}`, and an embed snippet.

## Worker / App configuration

| Secret / var | Purpose |
|--------------|---------|
| `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` | App credentials |
| `GITHUB_APP_INSTALLATION_ID` | Bootstrap install for `Plebly/proposals` |
| `GITHUB_WEBHOOK_SECRET` | HMAC for `POST /github/webhook` |
| `vars.PLEBLY_BRIDGE_WEBHOOK=1` on `Plebly/proposals` | Disables the same-repo Action so only the Worker drafts |

Webhook URL: `https://plebly-api.securesovereigns.workers.dev/github/webhook`

Events: `installation`, `installation_repositories`, `issues`, `issue_comment`.

Permissions: **Issues** (read/write) on customer installs; **Contents** + **Pull requests** on the proposals install (same App permission set applies everywhere).

## Authz

Only the issue author or a collaborator with `admin` / `maintain` / `write` may trigger a draft. Others get a rejection comment.

## Fee

Unpaid drafts use `submission_fee_txid: REPLACE_WITH_TXID` and stay Completeness-red until paid. The Worker never skips the fee.
