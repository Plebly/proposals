import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import matter from "gray-matter";
import { filenameIdErrors } from "./filename-id.mjs";

// assign-sequence resolves SEQUENCE.md and proposals/ relative to its own
// location, so each test runs a copy of it inside a throwaway repo root.
const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const year = new Date().getUTCFullYear();

function sandbox(nextSeq = 7) {
  const root = mkdtempSync(join(tmpdir(), "plebly-seq-"));
  mkdirSync(join(root, "scripts"));
  copyFileSync(join(repo, "scripts/assign-sequence.mjs"), join(root, "scripts/assign-sequence.mjs"));
  symlinkSync(join(repo, "node_modules"), join(root, "node_modules"));
  writeFileSync(
    join(root, "SEQUENCE.md"),
    `# Proposal ID sequence\n\n| Field | Value |\n|-------|-------|\n| Next sequence | ${nextSeq} |\n`,
  );
  for (const d of ["unindexed", "listed"]) mkdirSync(join(root, "proposals", d), { recursive: true });
  return root;
}

const proposal = (id = null, body = "Body text stays.") =>
  `---\nid: ${id === null ? "null" : id}\ntitle: "Some title"\nstatus: listed\n---\n\n# Some title\n\n${body}\n`;

function run(root, ...args) {
  const r = spawnSync(process.execPath, [join(root, "scripts/assign-sequence.mjs"), ...args], {
    cwd: root,
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

const nextSeq = (root) =>
  Number(readFileSync(join(root, "SEQUENCE.md"), "utf8").match(/Next sequence \| (\d+)/)[1]);

test("assigns the next id AND renames the file to <id>.md, so it passes the filename-id rule", () => {
  const root = sandbox(7);
  const file = join(root, "proposals/listed/my-slug.md");
  writeFileSync(file, proposal(null, "Keep this body."));
  const r = run(root, file);
  assert.equal(r.code, 0, r.out);

  const id = `PLEBLY-${year}-007`;
  const target = join(root, `proposals/listed/${id}.md`);
  assert.equal(existsSync(file), false, "old slug file must be gone");
  assert.equal(existsSync(target), true, r.out);
  const parsed = matter(readFileSync(target, "utf8"));
  assert.equal(parsed.data.id, id);
  assert.equal(parsed.data.title, "Some title");
  assert.match(parsed.content, /Keep this body\./);
  assert.deepEqual(filenameIdErrors(relative(root, target), parsed.data.id), []);
  assert.equal(nextSeq(root), 8);
  assert.match(r.out, /renamed to PLEBLY-\d{4}-007\.md/);
});

test("several files get consecutive ids and the counter advances once per file", () => {
  const root = sandbox(41);
  writeFileSync(join(root, "proposals/listed/a.md"), proposal(null, "Proposal A."));
  writeFileSync(join(root, "proposals/unindexed/b.md"), proposal(null, "Proposal B."));
  const r = run(root, "--all");
  assert.equal(r.code, 0, r.out);
  const all = [
    ...readdirSync(join(root, "proposals/unindexed")),
    ...readdirSync(join(root, "proposals/listed")),
  ].sort();
  assert.deepEqual(all, [`PLEBLY-${year}-041.md`, `PLEBLY-${year}-042.md`]);
  assert.equal(nextSeq(root), 43);
});

test("files that already have an id are left alone (name and bytes) and the counter doesn't move", () => {
  const root = sandbox(5);
  const file = join(root, "proposals/listed/PLEBLY-KEEP.md");
  const text = proposal("PLEBLY-KEEP");
  writeFileSync(file, text);
  const r = run(root, file);
  assert.equal(r.code, 0, r.out);
  assert.equal(readFileSync(file, "utf8"), text);
  assert.equal(nextSeq(root), 5);
  assert.match(r.out, /No proposals needed sequence ids/);
});

test("refuses when <id>.md already exists: exit 1, nothing overwritten, counter not consumed", () => {
  const root = sandbox(9);
  const id = `PLEBLY-${year}-009`;
  const existing = join(root, `proposals/listed/${id}.md`);
  const existingText = proposal(id, "Existing proposal must survive.");
  writeFileSync(existing, existingText);
  const file = join(root, "proposals/listed/new-slug.md");
  const fileText = proposal();
  writeFileSync(file, fileText);

  const r = run(root, file);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /already exists/);
  assert.equal(readFileSync(existing, "utf8"), existingText);
  assert.equal(readFileSync(file, "utf8"), fileText);
  assert.equal(nextSeq(root), 9);
});
