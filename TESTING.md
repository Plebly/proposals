# Testing on Signet

End-to-end checklist without multisig or mainnet.

## Automated battery (no coin risk by default)

| Tier | Command | Risk |
|------|---------|------|
| 0–1 unit + mocked API | `cd workers && npm test` | None — no broadcast, no live mempool writes |
| Frontend unit | `cd plebly.fund && npm test` | None |
| Proposal schema + fee helpers | `cd proposals && npm run validate:all && npm test` | None |
| 2 read-only live | `cd workers && npm run smoke:signet` | None — health + observe demo balance only |

Workers suite covers critical workflows: `HOOK_SECRET` hooks, exact fee/bond + `paytxid` anti-replay, durable `claimactive`, pending CAS, claim reopen/`claimed_at` sync, contrib identity + ballot 1p1v, FUNDABLE status, checkpoint SSRF, delete-account ledger retention, escrow allocate.

**Do not fund** the public BIP39 test-vector address `tb1qacjkk…` unless you control that key. Point `TEST_ESCROW_ADDRESS` / demo `escrow_address` at **your** wallet before any opt-in spend.

**Opt-in spend (Tier 3, manual only):** set your addresses, then use Sparrow. Never enable in CI.

**Fee / bond (exact):** Workers and CI require exact sats to `TEST_SUBMISSION_FEE_ADDRESS` / `SUBMISSION_FEE_ADDRESS`. Cross-purpose anti-replay uses KV `paytxid:{txid}` (legacy `bondtxid:` still honored). Bond/fee is **spent at verify** — if a claim PR never merges, the bond is still burned (forfeited). Lightning claimer can broadcast; keep it off on signet unless you intend Boltz **testnet** behavior.

**Ops hooks:** set `HOOK_SECRET` (never reuse `SESSION_SECRET`). Header `X-Plebly-Hook-Secret` for `/escrow/allocate`, `/claims/outcome`, `/claims/bonds/refundable`, ballots open/tally.

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

Use the flip path (does not invent KEYHOLDERS or bootstrap reviewers):

```bash
cd workers
cp deploy/mainnet.env.example deploy/mainnet.env   # fill PROPOSALS_SUBMISSION_FEE_ADDRESS
./scripts/flip-to-mainnet.sh --env deploy/mainnet.env --confirm
npm run smoke:mainnet
```

Manual gates the script does not skip:

1. Publish production section of `KEYHOLDERS.md` + Sparrow `ESCROW_ADDRESS_MAP`
2. Publish mainnet fee address in `PARAMETERS.md`
3. Bootstrap exactly five reviewers (`scripts/bootstrap-reviewers.sh`)
4. Confirm Pages rebuild with `VITE_BITCOIN_NETWORK=mainnet` (repo var)
5. Hook-allocate a listed proposal — must not return `pending_keyholders` / `pending_address_map`

Code invariants on flip: `feeAddress()` ignores leftover `TEST_*` on mainnet; Lightning auto-enables on mainnet; signet never enables Lightning (no Boltz pair).
