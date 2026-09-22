#!/usr/bin/env node
/** Ops: POST /claims/done/ops */
const api = (process.env.PLEBLY_API_URL || "").replace(/\/$/, "");
const secret = process.env.PLEBLY_HOOK_SECRET || "";
const proposalId = (process.env.PROPOSAL_ID || "").trim();
const proposalPath =
  (process.env.PROPOSAL_PATH || "").trim() ||
  (proposalId ? `proposals/listed/${proposalId}.md` : "");
if (!api || !secret || !proposalId) {
  console.error("PLEBLY_API_URL, PLEBLY_HOOK_SECRET, PROPOSAL_ID required");
  process.exit(1);
}
const body = { proposal_id: proposalId, proposal_path: proposalPath };
if (process.env.ALLOCATION_ID) body.allocation_id = process.env.ALLOCATION_ID.trim();
const res = await fetch(`${api}/claims/done/ops`, {
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
