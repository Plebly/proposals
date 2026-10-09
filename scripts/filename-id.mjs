import path from "node:path";

/**
 * Workers derives a proposal id from its filename in many places
 * (claim view, claim pool, checkpoints, challenges). A file named by slug
 * gets a second id there, so the filename stem must equal frontmatter `id`.
 *
 * `id: null` is allowed only under `proposals/unindexed/` (submissions wait
 * there for an id). Files outside `proposals/` (fixtures) are not checked.
 *
 * @param {string} relPath repo-relative path, e.g. proposals/listed/X.md
 * @param {unknown} id frontmatter id
 * @returns {string[]} errors (empty when ok)
 */
export function filenameIdErrors(relPath, id) {
  const rel = relPath.split(path.sep).join("/");
  if (!rel.startsWith("proposals/")) return [];
  const stem = path.posix.basename(rel, ".md");
  const fmId = typeof id === "string" ? id.trim() : "";
  if (!fmId) {
    if (rel.startsWith("proposals/unindexed/")) return [];
    return [
      `id: required outside proposals/unindexed/ (assign one, then name the file <id>.md)`,
    ];
  }
  if (stem !== fmId) {
    const want = path.posix.join(path.posix.dirname(rel), `${fmId}.md`);
    return [
      `filename: stem "${stem}" must equal frontmatter id "${fmId}" (rename to ${want})`,
    ];
  }
  return [];
}
