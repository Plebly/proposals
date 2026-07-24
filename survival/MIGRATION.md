# Survival and migration

## Site down

Use this repository and on-chain balances (Mempool.space or local node) directly. Escrow addresses remain valid.

## Continuous mirror

Maintain a continuous mirror of this repository on Codeberg or Forgejo. If GitHub becomes unavailable:

1. Freeze merges on remaining writable remotes.
2. Publish a signed announcement pointing at the mirror.
3. Update `PARAMETERS.md` with the new canonical remote URL.
4. Point Workers / site config at the new remote.

## Cloudflare unavailable

Escrow addresses and this git history remain authoritative. Redeploy Workers from `Plebly/workers` to any compatible edge runtime; restore KV from the latest export.

## KV / identity

OAuth link graphs are not fully reconstructible from chain. Export KV periodically. Contribution amounts and badges rebuild from chain + `ESCROW_INDEX.md` + `funders/`.
