#!/usr/bin/env node
/**
 * Assign PLEBLY-YYYY-NNN ids to proposal files that lack frontmatter `id`.
 * Bumps SEQUENCE.md. Safe to re-run (skips files that already have id).
 *
 * Usage: node scripts/assign-sequence.mjs [files...]
 *        node scripts/assign-sequence.mjs --all
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seqPath = path.join(root, "SEQUENCE.md");

function readNext() {
  const text = fs.readFileSync(seqPath, "utf8");
  const m = text.match(/\|\s*Next sequence\s*\|\s*(\d+)\s*\|/i);
  if (!m) throw new Error("SEQUENCE.md missing Next sequence row");
  return { text, next: Number(m[1]) };
}

function writeNext(text, next) {
  const updated = text.replace(
    /(\|\s*Next sequence\s*\|\s*)\d+(\s*\|)/i,
    `$1${next}$2`,
  );
  fs.writeFileSync(seqPath, updated);
}

function listAllProposalMd() {
  const dirs = ["unindexed", "listed", "declined", "claimed", "completed"];
  const out = [];
  for (const d of dirs) {
    const dir = path.join(root, "proposals", d);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (name.endsWith(".md")) out.push(path.join(dir, name));
    }
  }
  return out;
}

const args = process.argv.slice(2);
const files =
  args.includes("--all") || args.length === 0
    ? listAllProposalMd()
    : args.filter((f) => f.endsWith(".md")).map((f) => path.resolve(f));

let { text, next } = readNext();
const year = new Date().getUTCFullYear();
let assigned = 0;

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const raw = fs.readFileSync(file, "utf8");
  const parsed = matter(raw);
  if (parsed.data.id && String(parsed.data.id).trim()) continue;
  const id = `PLEBLY-${year}-${String(next).padStart(3, "0")}`;
  parsed.data.id = id;
  const out = matter.stringify(parsed.content.replace(/^\n/, ""), parsed.data);
  fs.writeFileSync(file, out.endsWith("\n") ? out : `${out}\n`);
  console.log(`${file}: assigned ${id}`);
  next += 1;
  assigned += 1;
}

if (assigned > 0) {
  writeNext(text, next);
  console.log(`SEQUENCE next → ${next} (${assigned} assigned)`);
} else {
  console.log("No proposals needed sequence ids.");
}
