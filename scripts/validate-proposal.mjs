#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const schema = JSON.parse(
  fs.readFileSync(path.join(root, "schema/proposal.schema.json"), "utf8"),
);

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const SECTION_RE = {
  deliverable: /^##\s+Deliverable\s*$/im,
  verification: /^##\s+Verification\s*$/im,
  out_of_scope: /^##\s+Out of scope\s*$/im,
};

function sectionBody(markdown, headingRe, nextHeadings) {
  const m = markdown.match(headingRe);
  if (!m) return "";
  const start = m.index + m[0].length;
  let end = markdown.length;
  for (const nh of nextHeadings) {
    const nm = markdown.slice(start).match(nh);
    if (nm) end = Math.min(end, start + nm.index);
  }
  return markdown.slice(start, end).trim();
}

function loadProposal(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const deliverable =
    data.deliverable ||
    sectionBody(content, SECTION_RE.deliverable, [
      SECTION_RE.verification,
      SECTION_RE.out_of_scope,
      /^##\s+/m,
    ]);
  const verification =
    data.verification ||
    sectionBody(content, SECTION_RE.verification, [
      SECTION_RE.out_of_scope,
      /^##\s+/m,
    ]);
  const out_of_scope =
    data.out_of_scope ||
    sectionBody(content, SECTION_RE.out_of_scope, [/^##\s+/m]);

  return {
    ...data,
    deliverable,
    verification,
    out_of_scope,
    milestones: data.milestones || [],
  };
}

/** Directory basename under proposals/ → expected status set. */
const DIR_STATUS = {
  listed: new Set(["listed", "declined_fundable", "funding", "claimable"]),
  funding: new Set(["funding", "claimable", "listed"]),
  claimable: new Set(["claimable", "funding"]),
  claimed: new Set(["claimed", "in_review"]),
  in_review: new Set(["in_review", "claimed"]),
  completed: new Set(["completed"]),
  rejected: new Set(["rejected"]),
  underfunded: new Set(["underfunded", "refunding", "abandoned_vote"]),
  refunding: new Set(["refunding", "underfunded"]),
  /** Archive / non-lifecycle holding area — status must still be explicit. */
  unindexed: new Set([
    "listed",
    "declined_fundable",
    "funding",
    "claimable",
    "claimed",
    "in_review",
    "completed",
    "rejected",
    "underfunded",
    "refunding",
    "abandoned_vote",
  ]),
};

function validateFile(filePath) {
  const proposal = loadProposal(filePath);
  const ok = validate(proposal);
  const errors = [];
  if (!ok) {
    for (const e of validate.errors || []) {
      errors.push(`${e.instancePath || "/"} ${e.message}`);
    }
  }
  if (!proposal.deliverable || proposal.deliverable.length < 20) {
    errors.push("deliverable: missing or too short (need ## Deliverable section or front matter)");
  }
  if (!proposal.verification || proposal.verification.length < 20) {
    errors.push("verification: missing or too short");
  }
  if (!proposal.out_of_scope || proposal.out_of_scope.length < 3) {
    errors.push("out_of_scope: missing or too short");
  }
  if (
    typeof proposal.target_sats === "number" &&
    proposal.target_sats >= 1_000_000 &&
    (!proposal.milestones || proposal.milestones.length < 1)
  ) {
    errors.push("milestones: required when target_sats >= 1000000");
  }
  const network = (process.env.BITCOIN_NETWORK || "").toLowerCase().trim();
  if (!network) {
    errors.push("BITCOIN_NETWORK env required (signet|testnet|mainnet)");
  } else {
    const mainnet = network === "mainnet" || network === "bitcoin";
    const hrp = mainnet ? "bc1" : "tb1";
    const escrow = proposal.escrow_address;
    if (escrow != null && escrow !== "" && String(escrow) !== "null") {
      const addr = String(escrow).trim();
      if (!new RegExp(`^${hrp}[a-z0-9]{20,90}$`, "i").test(addr)) {
        errors.push(
          `escrow_address: must be ${hrp}… for BITCOIN_NETWORK=${network}`,
        );
      }
    }
    const payout = proposal.payout_address;
    if (payout != null && payout !== "" && String(payout) !== "null") {
      const addr = String(payout).trim();
      if (!new RegExp(`^${hrp}[a-z0-9]{20,90}$`, "i").test(addr)) {
        errors.push(
          `payout_address: must be ${hrp}… for BITCOIN_NETWORK=${network}`,
        );
      }
    }
  }

  const rel = path.relative(root, filePath).replace(/\\/g, "/");
  const m = rel.match(/^proposals\/([^/]+)\//);
  if (m) {
    const dir = m[1];
    const allowed = DIR_STATUS[dir];
    const status = String(proposal.status || "").trim();
    if (!allowed) {
      errors.push(
        `unknown proposals directory "${dir}" — use a lifecycle dir (${Object.keys(DIR_STATUS).join(", ")})`,
      );
    } else if (status && !allowed.has(status)) {
      errors.push(
        `status "${status}" does not belong under proposals/${dir}/`,
      );
    }
  }

  return { ok: errors.length === 0, errors, proposal };
}

function listMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listMarkdown(full));
    else if (ent.name.endsWith(".md")) out.push(full);
  }
  return out;
}

function listProposalFiles() {
  const proposals = listMarkdown(path.join(root, "proposals"));
  const fixtures = listMarkdown(path.join(root, "scripts/fixtures"));
  return [...proposals, ...fixtures];
}

const args = process.argv.slice(2);
const all = args.includes("--all");
const files = all
  ? listProposalFiles()
  : args.filter((a) => !a.startsWith("--"));

if (files.length === 0) {
  console.log(all ? "No proposal markdown files found." : "Usage: validate-proposal.mjs <file.md>|--all");
  process.exit(all ? 0 : 1);
}

let failed = 0;
const idOwners = new Map();

// Always uniqueness-check against the full proposals tree so PR-scoped
// validation cannot reuse an unchanged file's id.
const checkedAbs = new Set(
  files.filter((f) => fs.existsSync(f)).map((f) => path.resolve(f)),
);
for (const f of listMarkdown(path.join(root, "proposals"))) {
  const abs = path.resolve(f);
  if (checkedAbs.has(abs)) continue;
  try {
    const p = loadProposal(f);
    const id =
      p?.id != null && String(p.id) !== "null" ? String(p.id).trim() : "";
    if (!id) continue;
    const rel = path.relative(root, f).replace(/\\/g, "/");
    if (!idOwners.has(id)) idOwners.set(id, rel);
  } catch {
    /* ignore unreadable peers */
  }
}

for (const f of files) {
  if (!fs.existsSync(f)) {
    // Deletions show up in git diff; nothing to validate.
    console.log(`SKIP ${path.relative(root, f)} (deleted)`);
    continue;
  }
  const { ok, errors, proposal } = validateFile(f);
  const rel = path.relative(root, f).replace(/\\/g, "/");
  const id =
    proposal?.id != null && String(proposal.id) !== "null"
      ? String(proposal.id).trim()
      : "";
  if (id && rel.startsWith("proposals/")) {
    const prev = idOwners.get(id);
    if (prev && path.resolve(root, prev) !== path.resolve(f)) {
      errors.push(`id "${id}" already used by ${prev}`);
    } else {
      idOwners.set(id, rel);
    }
  }
  if (ok && errors.length === 0) {
    console.log(`PASS ${rel}`);
  } else {
    failed++;
    console.log(`FAIL ${rel}`);
    for (const e of errors) console.log(`  - ${e}`);
  }
}
process.exit(failed ? 1 : 0);
