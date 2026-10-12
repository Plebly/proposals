/**
 * Fail-closed CI / ops gate behavior (no network).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import http from "node:http";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("allocate-on-merge fail-closed", () => {
  it("exits non-zero when secrets unset", () => {
    const r = spawnSync(process.execPath, ["scripts/allocate-on-merge.mjs"], {
      cwd: root,
      env: {
        ...process.env,
        PLEBLY_API_URL: "",
        PLEBLY_HOOK_SECRET: "",
      },
      encoding: "utf8",
    });
    assert.notEqual(r.status, 0);
    assert.match(`${r.stderr}${r.stdout}`, /fail closed|unset/i);
  });
});

describe("completeness fee-gate fail-closed", () => {
  it("workflow exits 1 when SUBMISSION_FEE_ADDRESS empty", () => {
    const yml = readFileSync(
      join(root, ".github/workflows/completeness.yml"),
      "utf8",
    );
    assert.match(yml, /SUBMISSION_FEE_ADDRESS/);
    assert.match(
      yml,
      /SUBMISSION_FEE_ADDRESS repo variable unset[\s\S]*?exit 1/,
    );
    assert.doesNotMatch(
      yml,
      /fee gate skipped[\s\S]{0,120}exit 0/,
    );
    assert.match(yml, /check-escrow-address\.mjs/);
    assert.match(yml, /list-changed-proposals\.mjs/);
    assert.match(
      yml,
      /BITCOIN_NETWORK repo variable unset[\s\S]*?exit 1/,
    );
    assert.doesNotMatch(
      yml,
      /MEMPOOL_API:-https:\/\/mempool\.space\/signet\/api/,
    );
    assert.doesNotMatch(
      yml,
      /mapfile -t files < <\(node scripts\/list-changed-proposals/,
    );
    assert.match(yml, /if ! changed="\$\(node scripts\/list-changed-proposals\.mjs/);
  });
});

describe("list-changed-proposals path canonicalization", () => {
  it("accepts uppercase PLEBLY ids and rejects shell characters", () => {
    const dir = mkdtempSync(join(tmpdir(), "plebly-list-"));
    const git = (...args) =>
      execFileSync("git", args, { cwd: dir, encoding: "utf8" });
    git("init", "-q");
    git("config", "user.email", "list@example.com");
    git("config", "user.name", "list");
    mkdirSync(join(dir, "proposals/listed"), { recursive: true });
    writeFileSync(join(dir, "proposals/listed/PLEBLY-2026-001.md"), "base\n");
    git("add", "proposals");
    git("commit", "-q", "-m", "base");
    const base = git("rev-parse", "HEAD").trim();
    writeFileSync(join(dir, "proposals/listed/PLEBLY-2026-001.md"), "edited\n");
    git("add", "proposals");
    git("commit", "-q", "-m", "edit");
    const ok = spawnSync(
      process.execPath,
      [join(root, "scripts/list-changed-proposals.mjs"), base, "HEAD"],
      { cwd: dir, encoding: "utf8" },
    );
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /proposals\/listed\/PLEBLY-2026-001\.md/);

    writeFileSync(join(dir, "proposals/listed/bad name.md"), "nope\n");
    git("add", "-A");
    git("commit", "-q", "-m", "bad");
    const bad = spawnSync(
      process.execPath,
      [join(root, "scripts/list-changed-proposals.mjs"), base, "HEAD"],
      { cwd: dir, encoding: "utf8" },
    );
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr, /Non-canonical proposal path/);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("escrow check shell-safe git show", () => {
  it("uses execFileSync and rejects metachar path", () => {
    const src = readFileSync(
      join(root, "scripts/check-escrow-address.mjs"),
      "utf8",
    );
    assert.match(src, /execFileSync/);
    assert.doesNotMatch(src, /execSync\(`git show/);
    const r = spawnSync(
      process.execPath,
      ["scripts/check-escrow-address.mjs", "proposals/listed/x$(true).md"],
      {
        cwd: root,
        env: {
          ...process.env,
          BITCOIN_NETWORK: "signet",
          ESCROW_ADDRESS_ALLOWLIST: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
          TEST_ESCROW_ADDRESS: "",
        },
        encoding: "utf8",
      },
    );
    assert.notEqual(r.status, 0);
    assert.match(`${r.stderr}${r.stdout}`, /unsafe proposal path/i);
  });
});

describe("allocate-on-merge git fail-closed", () => {
  it("source refuses mass-scan catch", () => {
    const src = readFileSync(
      join(root, "scripts/allocate-on-merge.mjs"),
      "utf8",
    );
    assert.match(src, /fail closed/);
    assert.doesNotMatch(src, /readdirSync\("proposals\/listed"\)/);
  });
});

describe("escrow allowlist gate", () => {
  it("rejects non-allowlisted escrow_address", () => {
    const r = spawnSync(
      process.execPath,
      [
        "scripts/check-escrow-address.mjs",
        "scripts/fixtures/valid.md",
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          BITCOIN_NETWORK: "signet",
          ESCROW_ADDRESS_ALLOWLIST: "",
          TEST_ESCROW_ADDRESS: "",
        },
        encoding: "utf8",
      },
    );
    // fixture has null escrow — should pass
    assert.equal(r.status, 0);
  });
});

describe("allocate-on-merge on a realistic push", () => {
  const ADDR = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";
  const OTHER = "tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7";

  function proposal(id, escrow) {
    const line = escrow ? `escrow_address: "${escrow}"\n` : "";
    return `---
id: ${id}
title: "Allocate fixture"
status: listed
${line}---
`;
  }

  function repoWith(baseBody, headWrite) {
    const dir = mkdtempSync(join(tmpdir(), "plebly-alloc-"));
    const git = (...args) =>
      execFileSync("git", args, { cwd: dir, encoding: "utf8" });
    git("init", "-q");
    git("config", "user.email", "alloc@example.com");
    git("config", "user.name", "alloc");
    mkdirSync(join(dir, "proposals/listed"), { recursive: true });
    writeFileSync(join(dir, "proposals/listed/PLEBLY-OLD.md"), baseBody);
    git("add", "proposals");
    git("commit", "-q", "-m", "base");
    const base = git("rev-parse", "HEAD").trim();
    headWrite(dir);
    git("add", "-A");
    git("commit", "-q", "-m", "head");
    const head = git("rev-parse", "HEAD").trim();
    return { dir, base, head };
  }

  function runAlloc(dir, base, head, extra = {}) {
    const env = {
      ...process.env,
      PLEBLY_API_URL: extra.api || "http://127.0.0.1:9",
      PLEBLY_HOOK_SECRET: "uat",
      ESCROW_ADDRESS_ALLOWLIST: ADDR,
      TEST_ESCROW_ADDRESS: "",
      GITHUB_EVENT_BEFORE: base,
      GITHUB_SHA: head,
      ...extra.env,
    };
    // Async spawn so a mock server in this process can answer fetch.
    if (extra.async) {
      return new Promise((resolve) => {
        const child = spawn(process.execPath, [join(root, "scripts/allocate-on-merge.mjs")], {
          cwd: dir,
          env,
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => {
          stdout += chunk;
        });
        child.stderr.on("data", (chunk) => {
          stderr += chunk;
        });
        child.on("close", (status) => resolve({ status, stdout, stderr }));
      });
    }
    return spawnSync(process.execPath, [join(root, "scripts/allocate-on-merge.mjs")], {
      cwd: dir,
      encoding: "utf8",
      env,
    });
  }

  it("refuses a new id that reuses an allowlisted escrow, including after the old file is deleted", () => {
    const kept = repoWith(proposal("PLEBLY-OLD", ADDR), (dir) => {
      writeFileSync(
        join(dir, "proposals/listed/PLEBLY-NEW.md"),
        proposal("PLEBLY-NEW", ADDR),
      );
    });
    const keptRun = runAlloc(kept.dir, kept.base, kept.head);
    assert.notEqual(keptRun.status, 0, keptRun.stdout + keptRun.stderr);
    assert.match(keptRun.stderr, /already used by proposal id PLEBLY-OLD/);
    rmSync(kept.dir, { recursive: true, force: true });

    const deleted = repoWith(proposal("PLEBLY-OLD", ADDR), (dir) => {
      rmSync(join(dir, "proposals/listed/PLEBLY-OLD.md"));
      writeFileSync(
        join(dir, "proposals/listed/PLEBLY-NEW.md"),
        proposal("PLEBLY-NEW", ADDR),
      );
    });
    const deletedRun = runAlloc(deleted.dir, deleted.base, deleted.head);
    assert.notEqual(deletedRun.status, 0, deletedRun.stdout + deletedRun.stderr);
    assert.match(deletedRun.stderr, /already used by proposal id PLEBLY-OLD/);
    rmSync(deleted.dir, { recursive: true, force: true });
  });

  it("calls allocate for a new listing with no escrow and keeps a unique allowlisted one", async () => {
    const hits = [];
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        hits.push(body);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ escrow_address: OTHER }));
      });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const api = `http://127.0.0.1:${server.address().port}`;
    try {
      const fresh = repoWith(proposal("PLEBLY-OLD", ADDR), (dir) => {
        writeFileSync(
          join(dir, "proposals/listed/PLEBLY-2026-011.md"),
          proposal("PLEBLY-2026-011"),
        );
      });
      const freshRun = await runAlloc(fresh.dir, fresh.base, fresh.head, { api, async: true });
      assert.equal(freshRun.status, 0, freshRun.stdout + freshRun.stderr);
      assert.equal(hits.length, 1);
      assert.match(hits[0], /PLEBLY-2026-011/);
      rmSync(fresh.dir, { recursive: true, force: true });

      hits.length = 0;
      const unique = repoWith(proposal("PLEBLY-OLD", ADDR), (dir) => {
        writeFileSync(
          join(dir, "proposals/listed/PLEBLY-2026-012.md"),
          proposal("PLEBLY-2026-012", OTHER),
        );
      });
      const uniqueRun = await runAlloc(unique.dir, unique.base, unique.head, {
        api,
        async: true,
        env: { ESCROW_ADDRESS_ALLOWLIST: `${ADDR},${OTHER}` },
      });
      assert.equal(uniqueRun.status, 0, uniqueRun.stdout + uniqueRun.stderr);
      assert.match(uniqueRun.stdout, /already has allowlisted/);
      assert.equal(hits.length, 0);
      rmSync(unique.dir, { recursive: true, force: true });
    } finally {
      server.close();
    }
  });
});
