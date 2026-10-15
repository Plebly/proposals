#!/usr/bin/env node
/**
 * After merge to main: for each newly listed proposal lacking escrow_address,
 * POST /escrow/allocate with HOOK_SECRET.
 *
 * Env:
 *   PLEBLY_API_URL — e.g. https://api.plebly.fund
 *   PLEBLY_HOOK_SECRET — Worker HOOK_SECRET
 *   ESCROW_ADDRESS_ALLOWLIST / TEST_ESCROW_ADDRESS — if escrow already set, must match
 *   GITHUB_EVENT_BEFORE / GITHUB_SHA — push range (preferred over HEAD~1)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
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
const SAFE_PATH = /^proposals\/listed\/[A-Za-z0-9][A-Za-z0-9_./-]*\.md$/;
const SAFE_TREE_PATH = /^proposals\/[A-Za-z0-9][A-Za-z0-9_./-]*\.md$/;
const ZERO = "0000000000000000000000000000000000000000";
const testEscrow = (process.env.TEST_ESCROW_ADDRESS || "").trim().toLowerCase();

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
let beforeRef = "";
try {
  const before = (process.env.GITHUB_EVENT_BEFORE || "").trim();
  const after = (process.env.GITHUB_SHA || "HEAD").trim();
  beforeRef = before;
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

const bad = files.filter((f) => !SAFE_PATH.test(f) || f.includes(".."));
if (bad.length) {
  console.error("Non-canonical listed proposal path(s) — refuse allocate:");
  for (const f of bad) console.error(`  - ${f}`);
  process.exit(1);
}

function addOwner(owners, id, escrow, want) {
  if (!id || escrow !== want) return;
  if (testEscrow && escrow === testEscrow) return;
  owners.add(id);
}

/** Other proposal ids that already publish this address (worktree and before ref). */
function otherOwners(address, exceptId) {
  const want = address.toLowerCase();
  const owners = new Set();
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name.endsWith(".md")) {
        const rel = full.split(path.sep).join("/");
        if (!SAFE_TREE_PATH.test(rel) || rel.includes("..")) continue;
        const { data } = matter(fs.readFileSync(full, "utf8"));
        const id = String(data.id || "").trim();
        const escrow = data.escrow_address
          ? String(data.escrow_address).trim().toLowerCase()
          : "";
        addOwner(owners, id, escrow, want);
      }
    }
  };
  walk("proposals");
  if (beforeRef && beforeRef !== ZERO && SAFE_REF.test(beforeRef) && !beforeRef.includes("..")) {
    let names = "";
    try {
      names = execFileSync(
        "git",
        ["ls-tree", "-r", "--name-only", beforeRef, "proposals"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch {
      names = "";
    }
    for (const name of names.split("\n").filter(Boolean)) {
      if (!SAFE_TREE_PATH.test(name) || name.includes("..")) continue;
      try {
        const raw = execFileSync("git", ["show", `${beforeRef}:${name}`], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
        const { data } = matter(raw);
        const id = String(data.id || "").trim();
        const escrow = data.escrow_address
          ? String(data.escrow_address).trim().toLowerCase()
          : "";
        addOwner(owners, id, escrow, want);
      } catch {
        /* skip */
      }
    }
  }
  owners.delete(exceptId);
  return [...owners];
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
    const others = addr === testEscrow ? [] : otherOwners(addr, id);
    if (others.length) {
      console.error(
        `${file}: escrow_address already used by proposal id ${others.join("|")} — refuse`,
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
