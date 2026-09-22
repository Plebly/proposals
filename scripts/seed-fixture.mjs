#!/usr/bin/env node
/**
 * workflow_dispatch / local: POST /proposals/seed-fixture with PLEBLY_HOOK_SECRET.
 *
 * Env:
 *   PLEBLY_API_URL — e.g. https://plebly-api.securesovereigns.workers.dev
 *   PLEBLY_HOOK_SECRET — Worker HOOK_SECRET
 *   SEED_ID — required (e.g. PLEBLY-2026-004)
 *   SEED_TITLE — required (3–200 chars)
 *   SEED_TAGS — comma-separated (default: docs) — docs forces AI bypass on Flag
 *   SEED_TARGET_SATS — optional
 *   SEED_CLAIM_MODE — optional (default first_bonded)
 */
const api = (process.env.PLEBLY_API_URL || "").replace(/\/$/, "");
const secret = process.env.PLEBLY_HOOK_SECRET || "";
const id = (process.env.SEED_ID || "").trim();
const title = (process.env.SEED_TITLE || "").trim();
if (!api || !secret) {
  console.error("PLEBLY_API_URL / PLEBLY_HOOK_SECRET required");
  process.exit(1);
}
if (!id) {
  console.error("SEED_ID required");
  process.exit(1);
}
if (!title || title.length < 3) {
  console.error("SEED_TITLE required (3–200 chars)");
  process.exit(1);
}

const tags = (process.env.SEED_TAGS || "docs")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const body = {
  id,
  title,
  tags,
  claim_mode: (process.env.SEED_CLAIM_MODE || "first_bonded").trim(),
};
if (process.env.SEED_TARGET_SATS) {
  body.target_sats = Number(process.env.SEED_TARGET_SATS);
}

const res = await fetch(`${api}/proposals/seed-fixture`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "X-Plebly-Hook-Secret": secret,
  },
  body: JSON.stringify(body),
});
const out = await res.json().catch(() => ({}));
console.log(JSON.stringify({ http_status: res.status, ...out }, null, 2));
if (!res.ok) process.exit(1);
