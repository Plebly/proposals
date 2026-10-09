#!/usr/bin/env node
/**
 * Ops: POST /reviewers/decisions/:id/tally (optional force early close).
 * Env: PLEBLY_API_URL, PLEBLY_HOOK_SECRET, DECISION_ID, optional FORCE=true
 */
const api = (process.env.PLEBLY_API_URL || "").replace(/\/$/, "");
const secret = process.env.PLEBLY_HOOK_SECRET || "";
const decisionId = (process.env.DECISION_ID || "").trim();
const force =
  String(process.env.FORCE || "true").toLowerCase() === "true" ||
  process.env.FORCE === "1";
if (!api || !secret || !decisionId) {
  console.error("PLEBLY_API_URL, PLEBLY_HOOK_SECRET, DECISION_ID required");
  process.exit(1);
}
const res = await fetch(
  `${api}/reviewers/decisions/${encodeURIComponent(decisionId)}/tally`,
  {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Plebly-Hook-Secret": secret,
    },
    body: JSON.stringify({ force }),
  },
);
const out = await res.json().catch(() => ({}));
console.log(JSON.stringify({ http_status: res.status, ...out }, null, 2));
if (!res.ok) process.exit(1);
