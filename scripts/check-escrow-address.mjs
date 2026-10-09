#!/usr/bin/env node
/**
 * CI gate: escrow_address must match network HRP and (when set) an allowlist
 * of Worker-allocated addresses. Also rejects escrow mutations vs base ref
 * (by path and by proposal id, so renames cannot bypass immutability).
 *
 * Env:
 *   BITCOIN_NETWORK — signet | testnet | mainnet (required when checking)
 *   ESCROW_ADDRESS_ALLOWLIST — comma-separated allowed addresses
 *   TEST_ESCROW_ADDRESS — optional; merged into allowlist (shared OK)
 *   ESCROW_COMPARE_REF — git ref for immutability (e.g. origin/main)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const network = (process.env.BITCOIN_NETWORK || "").toLowerCase().trim();
if (!network) {
  console.error("BITCOIN_NETWORK required for escrow checks");
  process.exit(1);
}
const mainnet = network === "mainnet" || network === "bitcoin";
const hrp = mainnet ? "bc1" : "tb1";
const compareRef = (process.env.ESCROW_COMPARE_REF || "").trim();

const testEscrow = (process.env.TEST_ESCROW_ADDRESS || "").trim().toLowerCase();
const allowlist = new Set(
  [
    ...(process.env.ESCROW_ADDRESS_ALLOWLIST || "").split(","),
    testEscrow,
  ]
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

/** Reject shell metacharacters / path traversal in git arguments. */
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const SAFE_PATH = /^proposals\/[a-z0-9][a-z0-9_./-]*\.md$/i;
const SAFE_FIXTURE = /^scripts\/fixtures\/[a-z0-9][a-z0-9_.-]*\.md$/i;

function normalizeRepoPath(file) {
  const rel = path.relative(root, path.resolve(root, file)).replace(/\\/g, "/");
  return rel;
}

function assertSafeInputPath(file) {
  const rel = normalizeRepoPath(file);
  if (rel.includes("..")) {
    throw new Error(`refusing unsafe proposal path: ${file}`);
  }
  if (SAFE_PATH.test(rel) || SAFE_FIXTURE.test(rel)) return rel;
  throw new Error(`refusing unsafe proposal path: ${file}`);
}

function assertSafeGitPath(file) {
  const rel = normalizeRepoPath(file);
  if (!SAFE_PATH.test(rel) || rel.includes("..")) {
    throw new Error(`refusing unsafe proposal path: ${file}`);
  }
  return rel;
}

function assertSafeRef(ref) {
  if (!SAFE_REF.test(ref) || ref.includes("..")) {
    throw new Error(`refusing unsafe git ref: ${ref}`);
  }
  return ref;
}

function gitShow(ref, file) {
  const r = assertSafeRef(ref);
  const p = assertSafeGitPath(file);
  return execFileSync("git", ["show", `${r}:${p}`], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 2 * 1024 * 1024,
  });
}

function parseEscrow(raw) {
  const { data } = matter(raw);
  const a = data.escrow_address;
  if (a == null || a === "" || a === false) return null;
  const s = String(a).trim();
  return !s || s === "null" ? null : s.toLowerCase();
}

function parseId(raw) {
  const { data } = matter(raw);
  if (data.id == null || data.id === "" || data.id === false) return "";
  const s = String(data.id).trim();
  return !s || s === "null" ? "" : s;
}

/** Map proposal id → escrow on compare ref (full tree). */
function baseEscrowById() {
  const map = new Map();
  if (!compareRef) return map;
  let names = "";
  try {
    names = execFileSync(
      "git",
      ["ls-tree", "-r", "--name-only", assertSafeRef(compareRef), "proposals"],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch {
    return map;
  }
  for (const name of names.split("\n").filter(Boolean)) {
    if (!SAFE_PATH.test(name)) continue;
    try {
      const raw = gitShow(compareRef, name);
      const id = parseId(raw);
      const escrow = parseEscrow(raw);
      if (id && escrow) map.set(id, escrow);
    } catch {
      /* skip */
    }
  }
  return map;
}

function priorEscrowAtPath(file) {
  if (!compareRef) return undefined;
  try {
    return parseEscrow(gitShow(compareRef, file));
  } catch {
    return undefined; // new path on base
  }
}

/** Current-tree escrow occupancy by address → proposal id (non-test shared). */
function currentEscrowOwners(filesBeingChecked) {
  const owners = new Map();
  const proposalsDir = path.join(root, "proposals");
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name.endsWith(".md")) {
        const rel = normalizeRepoPath(full);
        if (!SAFE_PATH.test(rel)) continue;
        const raw = fs.readFileSync(full, "utf8");
        const id = parseId(raw);
        const escrow = parseEscrow(raw);
        if (!id || !escrow) continue;
        if (testEscrow && escrow === testEscrow) continue;
        const prev = owners.get(escrow);
        if (prev && prev !== id) {
          owners.set(escrow, `${prev}|${id}`);
        } else {
          owners.set(escrow, id);
        }
      }
    }
  }
  walk(proposalsDir);
  // Prefer ids from files under check (they may be unsaved walks already covered)
  for (const file of filesBeingChecked) {
    if (!fs.existsSync(file)) continue;
    try {
      assertSafeGitPath(file);
    } catch {
      continue;
    }
    const raw = fs.readFileSync(file, "utf8");
    const id = parseId(raw);
    const escrow = parseEscrow(raw);
    if (!id || !escrow || (testEscrow && escrow === testEscrow)) continue;
    owners.set(escrow, id);
  }
  return owners;
}

const files = process.argv.slice(2).filter((f) => f.endsWith(".md"));
if (files.length === 0) {
  console.log("No proposal files for escrow check.");
  process.exit(0);
}

let failed = 0;
let sawEscrow = false;
const idOnBase = baseEscrowById();

for (const file of files) {
  let rel;
  try {
    rel = assertSafeInputPath(file);
  } catch (e) {
    console.error(String(e.message || e));
    failed++;
    continue;
  }
  if (!fs.existsSync(file)) continue;

  const raw = fs.readFileSync(file, "utf8");
  const { data } = matter(raw);
  const id = parseId(raw);
  const escrowRaw = data.escrow_address;
  if (escrowRaw == null || escrowRaw === "" || escrowRaw === false) continue;
  const addr = String(escrowRaw).trim();
  if (!addr || addr === "null") continue;
  sawEscrow = true;
  const addrLc = addr.toLowerCase();

  if (!new RegExp(`^${hrp}[a-z0-9]{20,90}$`, "i").test(addr)) {
    console.error(
      `${rel}: escrow_address HRP mismatch for ${network} (want ${hrp}…)`,
    );
    failed++;
    continue;
  }

  const priorPath = priorEscrowAtPath(rel);
  const priorId = id ? idOnBase.get(id) : undefined;
  const prior =
    priorPath !== undefined && priorPath !== null
      ? priorPath
      : priorId !== undefined
        ? priorId
        : priorPath; // undefined = new; null = was explicitly null

  if (prior !== undefined && prior !== null && prior !== addrLc) {
    console.error(
      `${rel}: escrow_address changed from ${prior} → ${addrLc} — refuse (immutable after allocate)`,
    );
    failed++;
    continue;
  }

  // First-intro (no prior escrow for this id/path): non-test addresses must be
  // exclusive to this proposal id across the tree.
  if ((prior === undefined || prior === null) && id) {
    if (!(testEscrow && addrLc === testEscrow)) {
      const owners = currentEscrowOwners(files);
      const owner = owners.get(addrLc);
      if (owner && owner !== id && !String(owner).split("|").includes(id)) {
        console.error(
          `${rel}: escrow_address already used by proposal id ${owner} — refuse first-intro reassignment`,
        );
        failed++;
        continue;
      }
    }
  }

  if (!allowlist.has(addrLc)) {
    console.error(
      `${rel}: escrow_address not in ESCROW_ADDRESS_ALLOWLIST / TEST_ESCROW_ADDRESS — refuse (allocate via Worker only)`,
    );
    failed++;
  } else {
    console.log(`${rel}: escrow_address allowlisted`);
  }
}

if (sawEscrow && allowlist.size === 0) {
  console.error(
    "ESCROW_ADDRESS_ALLOWLIST (or TEST_ESCROW_ADDRESS) required when proposals set escrow_address",
  );
  failed++;
}

if (failed) {
  console.error(`Escrow checks failed: ${failed}`);
  process.exit(1);
}
console.log("Escrow checks passed.");
