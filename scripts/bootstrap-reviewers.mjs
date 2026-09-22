#!/usr/bin/env node
/**
 * Ops: POST /reviewers/bootstrap with comma-separated USER_IDS.
 * Env: PLEBLY_API_URL, PLEBLY_HOOK_SECRET, USER_IDS (e.g. github:184555205)
 * Signet Worker allows 1–5; mainnet still requires 3–5.
 */
const api = (process.env.PLEBLY_API_URL || "").replace(/\/$/, "");
const secret = process.env.PLEBLY_HOOK_SECRET || "";
const raw = (process.env.USER_IDS || "").trim();
const userIds = raw
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (!api || !secret || userIds.length < 1 || userIds.length > 5) {
  console.error(
    "PLEBLY_API_URL, PLEBLY_HOOK_SECRET, USER_IDS (1–5 comma-separated) required",
  );
  process.exit(1);
}
const res = await fetch(`${api}/reviewers/bootstrap`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "X-Plebly-Hook-Secret": secret,
  },
  body: JSON.stringify({ user_ids: userIds }),
});
const out = await res.json().catch(() => ({}));
console.log(JSON.stringify({ http_status: res.status, ...out }, null, 2));
if (!res.ok) process.exit(1);
