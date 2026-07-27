#!/usr/bin/env node
/**
 * After merge to main: for each newly listed proposal lacking escrow_address,
 * POST /escrow/allocate with HOOK_SECRET.
 *
 * Env:
 *   PLEBLY_API_URL — e.g. https://plebly-api.securesovereigns.workers.dev
 *   PLEBLY_HOOK_SECRET — Worker HOOK_SECRET
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import matter from "gray-matter";

const api = (process.env.PLEBLY_API_URL || "").replace(/\/$/, "");
const secret = process.env.PLEBLY_HOOK_SECRET || "";
if (!api || !secret) {
  console.log("PLEBLY_API_URL / PLEBLY_HOOK_SECRET unset — skip allocate.");
  process.exit(0);
}

let files = [];
try {
  const out = execSync("git diff --name-only HEAD~1 HEAD", {
    encoding: "utf8",
  });
  files = out
    .split("\n")
    .map((s) => s.trim())
    .filter((f) => /^proposals\/listed\/.+\.md$/.test(f));
} catch {
  files = fs
    .readdirSync("proposals/listed")
    .filter((n) => n.endsWith(".md"))
    .map((n) => `proposals/listed/${n}`);
}

let called = 0;
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const { data } = matter(fs.readFileSync(file, "utf8"));
  const id = String(data.id || "").trim();
  const status = String(data.status || "listed");
  if (!id) {
    console.warn(`${file}: missing id — skip`);
    continue;
  }
  if (data.escrow_address) {
    console.log(`${file}: already has escrow_address`);
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
