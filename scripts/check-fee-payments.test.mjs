/**
 * Lightweight unit checks for fee-gate helpers (no network).
 * Run: node --test scripts/check-fee-payments.test.mjs
 */
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

describe("fee txid replay across deleted files", () => {
  const txid = "22".repeat(32);

  function git(dir, ...args) {
    return execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  }

  function repo() {
    const dir = mkdtempSync(join(tmpdir(), "plebly-replay-"));
    git(dir, "init", "-q");
    git(dir, "config", "user.email", "fee-replay@example.com");
    git(dir, "config", "user.name", "fee-replay");
    mkdirSync(join(dir, "proposals/listed"), { recursive: true });
    return dir;
  }

  function proposal(id, extra = "") {
    return `---
id: ${id}
title: "Replay fixture"
status: listed
submission_fee_txid: "${txid}"
${extra}---
`;
  }

  function listen() {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          txid,
          status: { confirmed: true },
          vout: [{ scriptpubkey_address: FEE, value: 10_000 }],
        }),
      );
    });
    return new Promise((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve(server));
    });
  }

  function run(dir, ref, api, ...files) {
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [script, ...files], {
        cwd: dir,
        env: {
          ...process.env,
          BITCOIN_NETWORK: "signet",
          SUBMISSION_FEE_ADDRESS: FEE,
          MEMPOOL_API: api,
          FEE_COMPARE_REF: ref,
        },
      });
      let out = "";
      child.stdout.on("data", (c) => {
        out += c;
      });
      child.stderr.on("data", (c) => {
        out += c;
      });
      child.on("close", (code) => resolve({ code, out }));
    });
  }

  it("rejects a txid after the listing that paid it was deleted", async () => {
    const dir = repo();
    const server = await listen();
    const api = `http://127.0.0.1:${server.address().port}`;
    try {
      writeFileSync(join(dir, "proposals/listed/PLEBLY-OLD.md"), proposal("PLEBLY-OLD"));
      git(dir, "add", "proposals");
      git(dir, "commit", "-q", "-m", "pay");
      rmSync(join(dir, "proposals/listed/PLEBLY-OLD.md"));
      git(dir, "add", "-A");
      git(dir, "commit", "-q", "-m", "delete");
      const base = git(dir, "rev-parse", "HEAD").trim();
      writeFileSync(join(dir, "proposals/listed/PLEBLY-NEW.md"), proposal("PLEBLY-NEW"));
      const r = await run(dir, base, api, "proposals/listed/PLEBLY-NEW.md");
      assert.notEqual(r.code, 0, r.out);
      assert.match(r.out, /already used by PLEBLY-OLD/);
      assert.doesNotMatch(r.out, /submission fee ok/);
    } finally {
      server.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lets the same proposal id keep its txid when the text changes", async () => {
    const dir = repo();
    const server = await listen();
    const api = `http://127.0.0.1:${server.address().port}`;
    try {
      const file = join(dir, "proposals/listed/PLEBLY-KEEP.md");
      writeFileSync(file, proposal("PLEBLY-KEEP"));
      git(dir, "add", "proposals");
      git(dir, "commit", "-q", "-m", "pay");
      const base = git(dir, "rev-parse", "HEAD").trim();
      writeFileSync(file, proposal("PLEBLY-KEEP", 'note: "edited"\n'));
      const r = await run(dir, base, api, "proposals/listed/PLEBLY-KEEP.md");
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /submission fee ok/);
    } finally {
      server.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
