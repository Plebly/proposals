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
for (const f of files) {
  if (!fs.existsSync(f)) {
    // Deletions show up in git diff; nothing to validate.
    console.log(`SKIP ${path.relative(root, f)} (deleted)`);
    continue;
  }
  const { ok, errors } = validateFile(f);
  if (ok) {
    console.log(`PASS ${path.relative(root, f)}`);
  } else {
    failed++;
    console.log(`FAIL ${path.relative(root, f)}`);
    for (const e of errors) console.log(`  - ${e}`);
  }
}
process.exit(failed ? 1 : 0);
