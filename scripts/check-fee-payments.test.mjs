/**
 * Lightweight unit checks for fee-gate helpers (no network).
 * Run: node --test scripts/check-fee-payments.test.mjs
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, copyFileSync } from "node:fs";
import http from "node:http";
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

describe("fee gate amount is fail-closed", () => {
  it("rejects an unpaid tx when parameters.json lowers the fee to 0", async () => {
    const dir = mkdtempSync(join(tmpdir(), "plebly-fee0-"));
    const txid = "11".repeat(32);
    mkdirSync(join(dir, "scripts"));
    mkdirSync(join(dir, "proposals/listed"), { recursive: true });
    copyFileSync(script, join(dir, "scripts/check-fee-payments.mjs"));
    symlinkSync(join(root, "node_modules"), join(dir, "node_modules"));
    const params = JSON.parse(readFileSync(join(root, "parameters.json"), "utf8"));
    params.shared.submission_fee_sats = 0;
    params.shared.claim_bond_sats = 0;
    writeFileSync(join(dir, "parameters.json"), JSON.stringify(params));
    writeFileSync(
      join(dir, "proposals/listed/PLEBLY-FREE.md"),
      `---\nid: PLEBLY-FREE\ntitle: "Unpaid"\nstatus: listed\nsubmission_fee_txid: "${txid}"\n---\n`,
    );
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          txid,
          status: { confirmed: true },
          vout: [{ scriptpubkey_address: "tb1qother", value: 50_000 }],
        }),
      );
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const api = `http://127.0.0.1:${server.address().port}`;
    try {
      const r = await new Promise((resolve) => {
        const child = spawn(
          process.execPath,
          [join(dir, "scripts/check-fee-payments.mjs"), "proposals/listed/PLEBLY-FREE.md"],
          {
            cwd: dir,
            env: {
              ...process.env,
              BITCOIN_NETWORK: "signet",
              SUBMISSION_FEE_ADDRESS: FEE,
              MEMPOOL_API: api,
            },
          },
        );
        let out = "";
        child.stdout.on("data", (c) => {
          out += c;
        });
        child.stderr.on("data", (c) => {
          out += c;
        });
        child.on("close", (code) => resolve({ code, out }));
      });
      assert.notEqual(r.code, 0, r.out);
      assert.match(r.out, /must be a safe integer >= 10000/);
      assert.doesNotMatch(r.out, /submission fee ok/);
    } finally {
      server.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
