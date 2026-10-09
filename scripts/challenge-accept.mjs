#!/usr/bin/env node
/**
 * Ops: POST /claims/challenge/accept — forfeit bond + clear active claim.
 * Env: PLEBLY_API_URL, PLEBLY_HOOK_SECRET, PROPOSAL_ID
 */
const api = (process.env.PLEBLY_API_URL || "").replace(/\/$/, "");
const secret = process.env.PLEBLY_HOOK_SECRET || "";
const proposalId = (process.env.PROPOSAL_ID || "").trim();
if (!api || !secret || !proposalId) {
  console.error("PLEBLY_API_URL, PLEBLY_HOOK_SECRET, PROPOSAL_ID required");
  process.exit(1);
}
const res = await fetch(`${api}/claims/challenge/accept`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "X-Plebly-Hook-Secret": secret,
  },
  body: JSON.stringify({ proposal_id: proposalId }),
});
const out = await res.json().catch(() => ({}));
console.log(JSON.stringify({ http_status: res.status, ...out }, null, 2));
if (!res.ok) process.exit(1);
