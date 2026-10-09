import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

// CLI-level tests for scripts/validate-proposal.mjs (the completeness gate CI
// runs on every proposal PR). Files live outside proposals/, so the
// filename-id rule (covered by filename-id.test.mjs) does not apply here.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(root, "scripts/validate-proposal.mjs");
const dir = mkdtempSync(join(tmpdir(), "plebly-validate-"));
const validFixture = readFileSync(join(root, "scripts/fixtures/valid.md"), "utf8");

let n = 0;
function file(text) {
  const p = join(dir, `p${n++}.md`);
  writeFileSync(p, text);
  return p;
}

function run(...args) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
  return { code: r.status, out: r.stdout + r.stderr };
}

const FM = `---
id: null
title: "A valid enough title"
status: pr_open
submission_fee_txid: "${"ab".repeat(32)}"
__EXTRA__---
`;
const LONG = "This sentence is comfortably longer than twenty characters.";
function doc({ extra = "", deliverable = LONG, verification = LONG, oos = "Nothing else.", tail = "" } = {}) {
  let s = FM.replace("__EXTRA__", extra) + "\n# T\n\n";
  if (deliverable !== null) s += `## Deliverable\n\n${deliverable}\n\n`;
  if (verification !== null) s += `## Verification\n\n${verification}\n\n`;
  if (oos !== null) s += `## Out of scope\n\n${oos}\n\n`;
  return s + tail;
}

test("the shipped fixture passes; exit 0", () => {
  const r = run(file(validFixture));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^PASS /m);
});

test("a minimal well-formed proposal passes", () => {
  const r = run(file(doc()));
  assert.equal(r.code, 0, r.out);
});

test("missing ## Deliverable section fails with the deliverable message", () => {
  const r = run(file(doc({ deliverable: null })));
  assert.equal(r.code, 1);
  assert.match(r.out, /^FAIL /m);
  assert.match(r.out, /deliverable: missing or too short/);
});

test("deliverable under 20 chars fails; exactly 20 passes", () => {
  assert.equal(run(file(doc({ deliverable: "x".repeat(19) }))).code, 1);
  assert.equal(run(file(doc({ deliverable: "x".repeat(20) }))).code, 0);
});

test("the Deliverable section stops at the next ## heading (later sections don't count)", () => {
  const r = run(
    file(doc({ deliverable: "too short", tail: `## Notes\n\n${LONG}\n${LONG}\n` })),
  );
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /deliverable: missing or too short/);
});

test("a section stops at a later unknown ## heading even when it comes before Verification", () => {
  const md =
    FM.replace("__EXTRA__", "") +
    `\n## Deliverable\n\nshort\n\n## Background\n\n${LONG}\n\n## Verification\n\n${LONG}\n\n## Out of scope\n\nNone.\n`;
  const r = run(file(md));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /deliverable: missing or too short/);
});

test("headings match case-insensitively", () => {
  const md = doc().replace("## Deliverable", "## deliverable").replace("## Out of scope", "## OUT OF SCOPE");
  assert.equal(run(file(md)).code, 0);
});

test("front matter deliverable/verification/out_of_scope override missing sections", () => {
  const extra = `deliverable: "${LONG}"\nverification: "${LONG}"\nout_of_scope: "None."\n`;
  const r = run(file(doc({ extra, deliverable: null, verification: null, oos: null })));
  assert.equal(r.code, 0, r.out);
});

test("verification under 20 chars and out_of_scope under 3 chars fail with their own messages", () => {
  let r = run(file(doc({ verification: "short" })));
  assert.equal(r.code, 1);
  assert.match(r.out, /verification: missing or too short/);
  r = run(file(doc({ oos: "no" })));
  assert.equal(r.code, 1);
  assert.match(r.out, /out_of_scope: missing or too short/);
});

test("target_sats >= 1,000,000 requires at least one milestone", () => {
  let r = run(file(doc({ extra: "target_sats: 1000000\nmilestones: []\n" })));
  assert.equal(r.code, 1);
  assert.match(r.out, /milestones: required when target_sats >= 1000000/);

  r = run(file(doc({ extra: "target_sats: 999999\nmilestones: []\n" })));
  assert.equal(r.code, 0, r.out);

  const milestone = `milestones:\n  - id: m1\n    deliverable: "Ship part one of it"\n    verification: "Reviewer checks part one"\n    out_of_scope: ""\n    allocation_sats: 1000000\n    deadline: "2027-01-01"\n`;
  r = run(file(doc({ extra: `target_sats: 1000000\n${milestone}` })));
  assert.equal(r.code, 0, r.out);
});

test("schema errors are reported: bad status enum, missing submission_fee_txid, short title", () => {
  let r = run(file(doc().replace("status: pr_open", "status: shipped")));
  assert.equal(r.code, 1);
  assert.match(r.out, /\/status must be equal to one of the allowed values/);

  r = run(file(doc().replace(/^submission_fee_txid:.*\n/m, "")));
  assert.equal(r.code, 1);
  assert.match(r.out, /must have required property 'submission_fee_txid'/);

  r = run(file(doc().replace('title: "A valid enough title"', 'title: "ab"')));
  assert.equal(r.code, 1);
  assert.match(r.out, /\/title must NOT have fewer than 3 characters/);
});

test("several files: one failure makes the run exit 1 and every file is reported", () => {
  const good = file(doc());
  const bad = file(doc({ deliverable: null }));
  const r = run(good, bad);
  assert.equal(r.code, 1);
  assert.equal((r.out.match(/^PASS /gm) || []).length, 1);
  assert.equal((r.out.match(/^FAIL /gm) || []).length, 1);
});

test("a path that no longer exists (deleted in the PR) is skipped, not failed", () => {
  const r = run(join(dir, "deleted.md"));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^SKIP .*\(deleted\)/m);
});

test("no file arguments prints usage and exits 1", () => {
  const r = run();
  assert.equal(r.code, 1);
  assert.match(r.out, /Usage: validate-proposal\.mjs/);
});

test("--all validates the repo's proposals and fixtures and exits 0 on main", () => {
  const r = run("--all");
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /PASS scripts\/fixtures\/valid\.md/);
});
