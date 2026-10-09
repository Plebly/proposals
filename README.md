# Plebly Proposals

Published rules for [plebly.fund](https://plebly.fund): fees, keyholders, reviewers, and schemas.

Live listings are on the site (Worker catalog). This repo is not an uncensorable listing record — GitHub or the operator can take it down, and the website chooses what to list.

- Escrow balances live on Bitcoin.
- `PARAMETERS.md`, `KEYHOLDERS.md`, and TOS are the published protocol text.

## Layout

Published protocol files. Listing folders below are leftover / fallback, not the live catalog.

| Path | Purpose |
|------|---------|
| `parameters.json` | Canonical numeric parameters (signet + mainnet overlays) |
| `PARAMETERS.md` | Human-readable parameters (tables synced from JSON) |
| `KEYHOLDERS.md` | Escrow / ops keyholders and descriptors |
| `REVIEWERS.md` | Active reviewer roster |
| `ESCROW_INDEX.md` | Monotonic index → proposal id |
| `proposals/` | Legacy proposal markdown by status folder (not the live listing path) |
| `funders/` | Per-proposal contribution mirrors |
| `decisions/` | Reviewer votes, dissent, rebuttals |
| `AI_PROMPTS/` | Versioned AI first-pass prompts |
| `schema/` | JSON Schema for proposals |
| `survival/` | Migration / mirror process |

## List a project

Use [plebly.fund/propose](https://plebly.fund/propose). Pay the on-chain submission fee. The Worker catalogs the listing. This repo is not required for a project to go live.

Third-party funding embeds: [`docs/embed.md`](docs/embed.md).

## License

CC0-1.0 (public domain dedication) for protocol text unless noted otherwise.
