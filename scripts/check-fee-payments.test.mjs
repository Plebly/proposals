/**
 * Lightweight unit checks for fee-gate helpers (no network).
 * Run: node --test scripts/check-fee-payments.test.mjs
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(root, "scripts/check-fee-payments.mjs");
const FEE = "tb1qehu65p8nw83kmg34ufdzelkjrk7ayslv6adqw2";
const ZERO = "0".repeat(64);
const SEEDS = [
  "proposals/listed/PLEBLY-SIGNET-DEMO.md",
  "proposals/listed/PLEBLY-KNOTS-SIZE-VALUE-SPAM.md",
];

function runFee(env, ...files) {
  const r = spawnSync(process.execPath, [script, ...files], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      BITCOIN_NETWORK: "signet",
      SUBMISSION_FEE_ADDRESS: FEE,
      ...env,
    },
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

function paidToFee(tx, feeAddress) {
  return (tx.vout || [])
    .filter((o) => o.scriptpubkey_address === feeAddress)
    .reduce((s, o) => s + (o.value || 0), 0);
}

describe("check-fee-payments helpers", () => {
  it("sums exact outputs to fee address", () => {
    const addr = "tb1qfee";
    const paid = paidToFee(
      {
        vout: [
          { scriptpubkey_address: addr, value: 4_000 },
          { scriptpubkey_address: "tb1qother", value: 1_000 },
          { scriptpubkey_address: addr, value: 6_000 },
        ],
      },
      addr,
    );
    assert.equal(paid, 10_000);
  });

  it("returns 0 when fee address unpaid", () => {
    assert.equal(
      paidToFee(
        { vout: [{ scriptpubkey_address: "tb1qother", value: 10_000 }] },
        "tb1qfee",
      ),
      0,
    );
  });
});

describe("signet zero-fee seed allowlist", () => {
  it("accepts the two documented seed listings and rejects any other zero txid", () => {
    const seeds = runFee({}, ...SEEDS);
    assert.equal(seeds.code, 0, seeds.out);
    assert.match(seeds.out, /Fee checks passed/);

    const dir = mkdtempSync(join(tmpdir(), "plebly-fee-"));
    try {
      const outside = join(dir, "PLEBLY-SIGNET-DEMO.md");
      writeFileSync(
        outside,
        `---\nid: PLEBLY-NOT-A-SEED\ntitle: "Not a seed"\nstatus: listed\nsubmission_fee_txid: "${ZERO}"\n---\n`,
      );
      const rejected = runFee({}, outside);
      assert.notEqual(rejected.code, 0, rejected.out);
      assert.match(rejected.out, /zero submission_fee_txid only allowed for seed demos/);
      assert.match(rejected.out, /proposals\/listed\/PLEBLY-SIGNET-DEMO\.md/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects the seed placeholder txid on mainnet", () => {
    const r = runFee({ BITCOIN_NETWORK: "mainnet" }, SEEDS[0]);
    assert.notEqual(r.code, 0, r.out);
    assert.match(r.out, /zero submission_fee_txid not allowed on mainnet/);
  });
});
