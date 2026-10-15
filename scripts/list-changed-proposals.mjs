#!/usr/bin/env node
/**
 * List changed proposal markdown paths between two git refs.
 * Fails closed if any proposals/*.md path is non-canonical (spaces, non-ASCII,
 * shell metacharacters, or "..") so fee/escrow gates cannot be skipped.
 * Uppercase is canonical: proposal ids are PLEBLY-… and the filename stem
 * must equal that id.
 *
 * Usage: node scripts/list-changed-proposals.mjs <base> [head]
 * Env: none required.
 *
 * Prints one repo-relative path per line on success.
 */
import { execFileSync } from "node:child_process";

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const SAFE_PATH = /^proposals\/[A-Za-z0-9][A-Za-z0-9_./-]*\.md$/;

const base = (process.argv[2] || "").trim();
const head = (process.argv[3] || "HEAD").trim();
if (!base) {
  console.error("usage: list-changed-proposals.mjs <base> [head]");
  process.exit(2);
}
if (!SAFE_REF.test(base) || base.includes("..")) {
  console.error(`refusing unsafe base ref: ${base}`);
  process.exit(1);
}
if (!SAFE_REF.test(head) || head.includes("..")) {
  console.error(`refusing unsafe head ref: ${head}`);
  process.exit(1);
}

let out = "";
try {
  out = execFileSync("git", ["diff", "--name-only", `${base}...${head}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (e) {
  console.error(
    "git diff failed — refuse listing proposal changes:",
    e instanceof Error ? e.message : e,
  );
  process.exit(1);
}

const all = out
  .split("\n")
  .map((s) => s.trim())
  .filter((f) => f.startsWith("proposals/") && f.endsWith(".md"));

const bad = all.filter((f) => !SAFE_PATH.test(f) || f.includes(".."));
if (bad.length) {
  console.error(
    "Non-canonical proposal path(s) — rename to proposals/<dir>/<ascii-id>.md with no spaces or shell characters:",
  );
  for (const f of bad) console.error(`  - ${f}`);
  process.exit(1);
}

for (const f of all) console.log(f);
