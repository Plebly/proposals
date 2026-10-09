import assert from "node:assert/strict";
import { test } from "node:test";
import { filenameIdErrors } from "./filename-id.mjs";

test("stem equal to id passes", () => {
  assert.deepEqual(
    filenameIdErrors("proposals/listed/PLEBLY-KNOTS-SIZE-VALUE-SPAM.md", "PLEBLY-KNOTS-SIZE-VALUE-SPAM"),
    [],
  );
  assert.deepEqual(filenameIdErrors("proposals/claimed/PLEBLY-2026-012.md", "PLEBLY-2026-012"), []);
});

test("slug-named file with an id fails with the rename target", () => {
  const errs = filenameIdErrors("proposals/listed/knots-size-value-spam.md", "PLEBLY-KNOTS-SIZE-VALUE-SPAM");
  assert.equal(errs.length, 1);
  assert.match(errs[0], /stem "knots-size-value-spam" must equal frontmatter id "PLEBLY-KNOTS-SIZE-VALUE-SPAM"/);
  assert.match(errs[0], /rename to proposals\/listed\/PLEBLY-KNOTS-SIZE-VALUE-SPAM\.md/);
});

test("case must match exactly", () => {
  assert.equal(filenameIdErrors("proposals/listed/plebly-2026-001.md", "PLEBLY-2026-001").length, 1);
});

test("unindexed submissions may have id null and any filename", () => {
  assert.deepEqual(filenameIdErrors("proposals/unindexed/issue-7-some-slug.md", null), []);
  assert.deepEqual(filenameIdErrors("proposals/unindexed/issue-7-some-slug.md", ""), []);
});

test("unindexed file that already has an id must still match", () => {
  assert.equal(filenameIdErrors("proposals/unindexed/issue-7-some-slug.md", "PLEBLY-2026-013").length, 1);
});

test("id null outside unindexed fails", () => {
  const errs = filenameIdErrors("proposals/listed/some-slug.md", null);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /id: required outside proposals\/unindexed\//);
});

test("fixtures outside proposals/ are not checked", () => {
  assert.deepEqual(filenameIdErrors("scripts/fixtures/valid.md", null), []);
});
