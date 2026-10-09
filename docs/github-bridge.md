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

| Secret / var | Purpose | Status (2026-07-27) |
|--------------|---------|---------------------|
| `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` | App credentials | Set on Worker |
| `GITHUB_APP_INSTALLATION_ID` | Bootstrap install for `Plebly/proposals` | Set on Worker |
| `GITHUB_WEBHOOK_SECRET` | HMAC for `POST /github/webhook` | Set on Worker — paste the same value into the App webhook “Secret” field |
| `vars.PLEBLY_BRIDGE_WEBHOOK=1` on `Plebly/proposals` | Disables the same-repo Action so only the Worker drafts | Set |
| Labels `plebly` / `plebly-proposal` on `Plebly/proposals` | Same-repo triggers | Created |

Webhook URL (paste into App settings): `https://plebly-api.securesovereigns.workers.dev/github/webhook`

### Permissions first (then events appear)

Set these under **Repository permissions**, then scroll to **Subscribe to events** (the event checklist only shows events allowed by the permissions above):

| Permission | Access |
|------------|--------|
| **Issues** | Read and write |
| **Contents** | Read and write |
| **Pull requests** | Read and write |
| **Metadata** | Read-only (required; usually auto) |

### Subscribe to events (UI labels)

After Issues is granted, check:

- **Issues** (API: `issues` — label → draft)
- **Issue comment** (API: `issue_comment` — `/plebly` command)

Do **not** rely on the list you see without Issues permission (Push, Fork, Star, etc.). You do **not** need Pull request / Push / Workflow events for the bridge.

`installation` / `installation_repositories` are App lifecycle deliveries (map install → repos). They often are **not** in that same checkbox list (or only “Installation target” appears, which is a rename event — skip it). Leave webhooks enabled; GitHub still sends install/repo-access payloads to the App webhook URL.

Still human: make the App public/optional (or installable), set webhook URL + secret in the GitHub App UI, install on at least one non-`Plebly/proposals` test repo.

### App listing copy (optional)

**Description:** Turn a GitHub issue into a Plebly Bitcoin bounty draft. Label `plebly` or comment `/plebly`, pay the submission fee on plebly.fund, then fund the escrow after listing.

**Homepage URL:** `https://plebly.fund`

### Not an App setting: `PLEBLY_HOOK_SECRET`

That secret is for **GitHub Actions on `Plebly/proposals`**, not the App form:

1. Repo → **Settings → Secrets and variables → Actions → New repository secret**
2. Name: `PLEBLY_HOOK_SECRET`
3. Value: the Worker’s existing `HOOK_SECRET` (ops hook; never reuse `GITHUB_WEBHOOK_SECRET` or `SESSION_SECRET`)

Used by `allocate-on-merge.yml` to call `POST /escrow/allocate`. `vars.PLEBLY_API_URL` is already set.

## Authz

Only the issue author or a collaborator with `admin` / `maintain` / `write` may trigger a draft. Others get a rejection comment.

## Fee

Unpaid drafts use `submission_fee_txid: REPLACE_WITH_TXID` and stay Completeness-red until paid. The Worker never skips the fee.
