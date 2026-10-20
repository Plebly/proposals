/**
 * Escrow address exclusivity: a first-intro must not take an address another
 * proposal id already publishes, even when that address is allowlisted.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const ADDR = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";
const OTHER = "tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7";

function proposal(id, escrow) {
  return `---
id: ${id}
title: "Escrow exclusivity fixture"
status: listed
escrow_address: "${escrow}"
---
`;
}

function sandbox() {
  const root = mkdtempSync(join(tmpdir(), "plebly-escrow-"));
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(root, "proposals/listed"), { recursive: true });
  copyFileSync(
    join(repo, "scripts/check-escrow-address.mjs"),
    join(root, "scripts/check-escrow-address.mjs"),
  );
  symlinkSync(join(repo, "node_modules"), join(root, "node_modules"));
  return root;
}

function run(root, env, ...files) {
  const r = spawnSync(
    process.execPath,
    [join(root, "scripts/check-escrow-address.mjs"), ...files],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        BITCOIN_NETWORK: "signet",
        ESCROW_COMPARE_REF: "",
        TEST_ESCROW_ADDRESS: "",
        ESCROW_ADDRESS_ALLOWLIST: ADDR,
        ...env,
      },
    },
  );
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

test("first-intro of an address another proposal already uses is refused", () => {
  const root = sandbox();
  writeFileSync(
    join(root, "proposals/listed/PLEBLY-EXISTING.md"),
    proposal("PLEBLY-EXISTING", ADDR),
  );
  const incoming = join(root, "proposals/listed/PLEBLY-INCOMING.md");
  writeFileSync(incoming, proposal("PLEBLY-INCOMING", ADDR));

  const r = run(root, {}, incoming);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /already used by proposal id PLEBLY-EXISTING/);
  assert.match(r.out, /refuse first-intro reassignment/);
});

test("the sole owner of an allowlisted escrow address still passes", () => {
  const root = sandbox();
  const file = join(root, "proposals/listed/PLEBLY-ONLY.md");
  writeFileSync(file, proposal("PLEBLY-ONLY", ADDR));
  const r = run(root, {}, file);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /allowlisted/);
});

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function gitSandbox() {
  const root = sandbox();
  git(root, "init", "-q");
  git(root, "config", "user.email", "escrow-test@example.com");
  git(root, "config", "user.name", "escrow-test");
  return root;
}

test("deleting a listing and republishing its escrow under a new id is refused", () => {
  const root = gitSandbox();
  writeFileSync(
    join(root, "proposals/listed/PLEBLY-OLD.md"),
    proposal("PLEBLY-OLD", ADDR),
  );
  git(root, "add", "proposals");
  git(root, "commit", "-q", "-m", "base");
  const base = git(root, "rev-parse", "HEAD").trim();
  rmSync(join(root, "proposals/listed/PLEBLY-OLD.md"));
  const incoming = join(root, "proposals/listed/PLEBLY-NEW.md");
  writeFileSync(incoming, proposal("PLEBLY-NEW", ADDR));
  const r = run(root, { ESCROW_COMPARE_REF: base }, incoming);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out, /already used by proposal id PLEBLY-OLD/);
});

test("moving a listing to another directory keeps the same escrow", () => {
  const root = gitSandbox();
  const src = join(root, "proposals/listed/PLEBLY-OLD.md");
  writeFileSync(src, proposal("PLEBLY-OLD", ADDR));
  git(root, "add", "proposals");
  git(root, "commit", "-q", "-m", "base");
  const base = git(root, "rev-parse", "HEAD").trim();
  mkdirSync(join(root, "proposals/funding"), { recursive: true });
  const dst = join(root, "proposals/funding/PLEBLY-OLD.md");
  writeFileSync(dst, readFileSync(src, "utf8").replace("status: listed", "status: funding"));
  rmSync(src);
  const r = run(root, { ESCROW_COMPARE_REF: base }, dst);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /allowlisted/);
});

test("clearing an allocated escrow_address is refused", () => {
  const root = gitSandbox();
  const file = join(root, "proposals/listed/PLEBLY-KEEP.md");
  writeFileSync(file, proposal("PLEBLY-KEEP", ADDR));
  git(root, "add", "proposals");
  git(root, "commit", "-q", "-m", "base");
  const base = git(root, "rev-parse", "HEAD").trim();

  writeFileSync(
    file,
    proposal("PLEBLY-KEEP", ADDR).replace(`escrow_address: "${ADDR}"\n`, "escrow_address: null\n"),
  );
  const cleared = run(root, { ESCROW_COMPARE_REF: base, ESCROW_ADDRESS_ALLOWLIST: `${ADDR},${OTHER}` }, file);
  assert.notEqual(cleared.code, 0, cleared.out);
  assert.match(cleared.out, /escrow_address removed \(was tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx\)/);

  writeFileSync(
    file,
    `---\nid: PLEBLY-KEEP\ntitle: "Escrow exclusivity fixture"\nstatus: listed\n---\n`,
  );
  const omitted = run(root, { ESCROW_COMPARE_REF: base, ESCROW_ADDRESS_ALLOWLIST: `${ADDR},${OTHER}` }, file);
  assert.notEqual(omitted.code, 0, omitted.out);
  assert.match(omitted.out, /escrow_address removed/);
  rmSync(root, { recursive: true, force: true });
});

test("TEST_ESCROW_ADDRESS may be shared across proposal ids", () => {
  const root = sandbox();
  writeFileSync(
    join(root, "proposals/listed/PLEBLY-A.md"),
    proposal("PLEBLY-A", OTHER),
  );
  const incoming = join(root, "proposals/listed/PLEBLY-B.md");
  writeFileSync(incoming, proposal("PLEBLY-B", OTHER));
  const r = run(
    root,
    {
      ESCROW_ADDRESS_ALLOWLIST: "",
      TEST_ESCROW_ADDRESS: OTHER,
    },
    incoming,
  );
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /allowlisted/);
});
