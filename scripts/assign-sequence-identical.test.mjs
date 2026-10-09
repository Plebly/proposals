import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import matter from "gray-matter";

// gray-matter caches parse results by file content and hands back a shallow
// copy that SHARES `data`. assign-sequence used to set `parsed.data.id`, so a
// second byte-identical id-less file (e.g. two untouched template drafts)
// looked already assigned and silently kept `id: null`.
const repo = join(dirname(fileURLToPath(import.meta.url)), "..");

test("two byte-identical id-less proposals both get their own id", () => {
  const root = mkdtempSync(join(tmpdir(), "plebly-seq-same-"));
  mkdirSync(join(root, "scripts"));
  copyFileSync(join(repo, "scripts/assign-sequence.mjs"), join(root, "scripts/assign-sequence.mjs"));
  symlinkSync(join(repo, "node_modules"), join(root, "node_modules"));
  writeFileSync(join(root, "SEQUENCE.md"), "| Field | Value |\n|---|---|\n| Next sequence | 3 |\n");
  mkdirSync(join(root, "proposals/unindexed"), { recursive: true });
  const text = `---\nid: null\ntitle: "Same draft"\nstatus: pr_open\n---\n\nSame body.\n`;
  const a = join(root, "proposals/unindexed/a.md");
  const b = join(root, "proposals/unindexed/b.md");
  writeFileSync(a, text);
  writeFileSync(b, text);

  const r = spawnSync(process.execPath, [join(root, "scripts/assign-sequence.mjs"), a, b], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  // Read every file in the dir (works whether or not the script renames files
  // to <id>.md, see #25), with options so gray-matter's cache can't mask it.
  const dir = join(root, "proposals/unindexed");
  const ids = readdirSync(dir)
    .sort()
    .map((f) => matter(readFileSync(join(dir, f), "utf8"), { language: "yaml" }).data.id)
    .sort();
  const seq = Number(readFileSync(join(root, "SEQUENCE.md"), "utf8").match(/Next sequence \| (\d+)/)[1]);
  assert.equal(seq, 5, `both files must consume a number (got next=${seq})\n${r.stdout}`);
  const year = new Date().getUTCFullYear();
  assert.deepEqual(ids, [`PLEBLY-${year}-003`, `PLEBLY-${year}-004`]);
});
