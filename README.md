# Plebly Proposals

Canonical, forkable record for [plebly.fund](https://plebly.fund) bounties.

- Proposals enter via pull request (direct GitHub or the site Worker).
- Completeness is checked by CI.
- Escrow balances live on Bitcoin; this repo holds proposal text, reviewer decisions, and published keys.

## Layout

| Path | Purpose |
|------|---------|
| `PARAMETERS.md` | Launch parameters and fee addresses |
| `KEYHOLDERS.md` | Escrow / ops keyholders and descriptors |
| `REVIEWERS.md` | Active reviewer roster |
| `ESCROW_INDEX.md` | Monotonic index → proposal id |
| `proposals/` | Proposal records by status folder |
| `funders/` | Per-proposal contribution mirrors |
| `decisions/` | Reviewer votes, dissent, rebuttals |
| `AI_PROMPTS/` | Versioned AI first-pass prompts |
| `schema/` | JSON Schema for proposals |
| `survival/` | Migration / mirror process |

## Submit a proposal

1. Copy `template/proposal.md`.
2. Pay the submission fee (see `PARAMETERS.md`) and record the txid.
3. Open a PR adding the file under `proposals/unindexed/`.
4. CI must pass; fee must verify before merge.

## License

CC0-1.0 (public domain dedication) for protocol text unless noted otherwise.
