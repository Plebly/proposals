# Testing on Signet

End-to-end checklist without multisig or mainnet.

## Automated battery (no coin risk by default)

| Tier | Command | Risk |
|------|---------|------|
| 0–1 unit + mocked API | `cd workers && npm test` | None — no broadcast, no live mempool writes |
| 2 read-only live | `cd workers && npm run smoke:signet` | None — health + observe demo balance only |
| Proposal schema | `cd proposals && npm run validate:all` | None |

**Do not fund** the public BIP39 test-vector address `tb1qacjkk…` unless you control that key. Point `TEST_ESCROW_ADDRESS` / demo `escrow_address` at **your** wallet before any opt-in spend.

**Opt-in spend (Tier 3, manual only):** set your addresses, then use Sparrow. Never enable in CI. Signet fee/bond checks are currently stubs (any found tx may pass) — do not treat a successful submit as proving fee integrity. Lightning claimer can broadcast; keep it off on signet unless you intend Boltz **testnet** behavior.

## 1. Your signet wallet

- Sparrow → Settings → Network → **Signet**
- Create or open a wallet → copy a receive address (`tb1…`)

## 2. Configure Workers

Edit `workers/wrangler.toml`:

```toml
BITCOIN_NETWORK = "signet"
TEST_ESCROW_ADDRESS = "tb1YOUR_ADDRESS"
TEST_SUBMISSION_FEE_ADDRESS = "tb1YOUR_ADDRESS_OR_SECOND"
```

```bash
cd workers && npx wrangler deploy
```

Check: `curl https://plebly-api.securesovereigns.workers.dev/health`  
→ `"network":"signet"`, `"signet_test_escrow":true`

## 3. Get signet sats

- https://bitcoinsignetfaucet.com/ (recommended — 1k–10k sats per request)
- https://signetfaucet.com/ (captcha; may discard bot-like requests)
- Send a small amount to your address

## 4. List a test bounty

Option A — **fast path:** merge the demo proposal in `proposals/listed/demo-signet-smoke.md` (update `escrow_address` to yours).

Option B — **full path:**

1. Pay 10k sats to `TEST_SUBMISSION_FEE_ADDRESS` on signet (note txid)
2. Open PR from `template/proposal.md` with that txid
3. Merge to `unindexed/` → reviewer moves to `listed/` with your `escrow_address`

## 5. Verify the site

- https://plebly.fund — demo bounty shows balance from signet mempool
- Fund the escrow address → balance updates

## 6. Login + submit (optional)

- Log in with GitHub on plebly.fund
- Submit form (needs GitHub App secrets on Worker)

## Claim floor on signet

Still **100,000 sats** in parameters. For cheap tests, fund ≥100k signet sats once or temporarily lower in a test branch only.

## When ready for mainnet

1. Fill production section of `KEYHOLDERS.md`
2. Set `BITCOIN_NETWORK = "mainnet"` and `MEMPOOL_API = "https://mempool.space/api"`
3. Remove / ignore `TEST_ESCROW_*` vars
