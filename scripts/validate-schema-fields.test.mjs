import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(
  readFileSync(join(root, "schema/proposal.schema.json"), "utf8"),
);

test("schema exposes post-MVP foundation fields", () => {
  assert.deepEqual(schema.properties.proposal_type.enum, ["bounty", "direct"]);
  assert.equal(schema.properties.proposal_type.default, "bounty");
  assert.equal(schema.properties.tags.maxItems, 12);
  assert.ok(schema.properties.parent_initiative);
  assert.ok(schema.properties.delivery_window_ends_at);
  assert.ok(
    schema.properties.milestones.items.properties.funding_threshold_sats,
  );
  assert.equal(
    schema.properties.milestones.items.properties.funding_threshold_sats
      .minimum,
    1,
  );
});

test("template frontmatter includes proposal_type and tags", () => {
  const template = readFileSync(join(root, "template/proposal.md"), "utf8");
  assert.match(template, /proposal_type:\s*bounty/);
  assert.match(template, /tags:\s*\[/);
  assert.match(template, /parent_initiative:/);
  assert.match(template, /funding_threshold_sats/);
});
