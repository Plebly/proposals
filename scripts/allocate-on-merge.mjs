#!/usr/bin/env node
/**
 * After merge to main: for each newly listed proposal lacking escrow_address,
 * POST /escrow/allocate with HOOK_SECRET.
 *
 * Env:
 *   PLEBLY_API_URL — e.g. https://plebly-api.securesovereigns.workers.dev
 *   PLEBLY_HOOK_SECRET — Worker HOOK_SECRET
 *   ESCROW_ADDRESS_ALLOWLIST / TEST_ESCROW_ADDRESS — if escrow already set, must match
 *   GITHUB_EVENT_BEFORE / GITHUB_SHA — push range (preferred over HEAD~1)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import matter from "gray-matter";

const api = (process.env.PLEBLY_API_URL || "").replace(/\/$/, "");
const secret = process.env.PLEBLY_HOOK_SECRET || "";
if (!api || !secret) {
  console.error(
    "PLEBLY_API_URL / PLEBLY_HOOK_SECRET unset — refuse allocate-on-merge (fail closed).",
  );
  process.exit(1);
}

const allowlist = new Set(
  [
    ...(process.env.ESCROW_ADDRESS_ALLOWLIST || "").split(","),
    process.env.TEST_ESCROW_ADDRESS || "",
  ]
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const SAFE_PATH = /^proposals\/listed\/[a-z0-9][a-z0-9_./-]*\.md$/;
const ZERO = "0000000000000000000000000000000000000000";

function assertSafeRef(ref) {
  if (!SAFE_REF.test(ref) || ref.includes("..")) {
    throw new Error(`refusing unsafe git ref: ${ref}`);
  }
  return ref;
}

function listedDiff(base, head) {
  const out = execFileSync(
    "git",
    ["diff", "--name-only", `${assertSafeRef(base)}...${assertSafeRef(head)}`],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter((f) => f.startsWith("proposals/listed/") && f.endsWith(".md"));
}

let files = [];
try {
  const before = (process.env.GITHUB_EVENT_BEFORE || "").trim();
  const after = (process.env.GITHUB_SHA || "HEAD").trim();
  if (before && before !== ZERO) {
    files = listedDiff(before, after);
  } else {
    // Fallback when before SHA missing: scan last merge-range via ORIG_HEAD or HEAD~1.
    try {
      files = listedDiff("ORIG_HEAD", "HEAD");
    } catch {
      files = listedDiff("HEAD~1", "HEAD");
    }
  }
} catch (e) {
  console.error(
    "git diff failed — refuse allocate-on-merge (fail closed):",
    e instanceof Error ? e.message : e,
  );
  process.exit(1);
}

const bad = files.filter((f) => !SAFE_PATH.test(f));
if (bad.length) {
  console.error("Non-canonical listed proposal path(s) — refuse allocate:");
  for (const f of bad) console.error(`  - ${f}`);
  process.exit(1);
}

let called = 0;
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const { data } = matter(fs.readFileSync(file, "utf8"));
  const id = String(data.id || "").trim();
  const status = String(data.status || "listed");
  if (!id) {
    console.error(`${file}: missing id — refuse allocate-on-merge`);
    process.exitCode = 1;
    continue;
  }
  if (data.escrow_address) {
    const addr = String(data.escrow_address).trim().toLowerCase();
    if (!allowlist.has(addr)) {
      console.error(
        `${file}: escrow_address set but not allowlisted — refuse (possible theft path)`,
      );
      process.exitCode = 1;
      continue;
    }
    console.log(`${file}: already has allowlisted escrow_address`);
    continue;
  }
  if (!["listed", "declined_fundable"].includes(status)) {
    console.log(`${file}: status ${status} — skip`);
    continue;
  }
  const res = await fetch(`${api}/escrow/allocate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Plebly-Hook-Secret": secret,
    },
    body: JSON.stringify({
      proposal_id: id,
      status,
      proposal_path: file,
      patch_proposal: true,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`${file}: allocate ${res.status}`, body);
    process.exitCode = 1;
    continue;
  }
  console.log(`${file}: allocated`, body.escrow_address || body);
  called += 1;
}

console.log(`allocate-on-merge done (${called} calls)`);
