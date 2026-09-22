#!/usr/bin/env node
/**
 * Ops: POST /reviewers/decisions/open with optional ai_review (bypass → escalated).
 * Env: PLEBLY_API_URL, PLEBLY_HOOK_SECRET, PROPOSAL_ID, PROPOSAL_PATH, KIND, AI_OUTCOME
 */
const api = (process.env.PLEBLY_API_URL || "").replace(/\/$/, "");
const secret = process.env.PLEBLY_HOOK_SECRET || "";
const proposalId = (process.env.PROPOSAL_ID || "").trim();
const proposalPath =
  (process.env.PROPOSAL_PATH || "").trim() ||
  (proposalId ? `proposals/listed/${proposalId}.md` : "");
const kind = (process.env.KIND || "deliverable_confirm").trim();
const outcome = (process.env.AI_OUTCOME || "bypass").trim();
if (!api || !secret || !proposalId || !proposalPath) {
  console.error("PLEBLY_API_URL, PLEBLY_HOOK_SECRET, PROPOSAL_ID required");
  process.exit(1);
}
const body = {
  proposal_id: proposalId,
  proposal_path: proposalPath,
  kind,
  round: 1,
  ai_review: {
    outcome,
    reasoning:
      process.env.AI_REASONING ||
      `Hook open for escalate/unsure gate (${outcome})`,
    prompt_version: "hook",
    model: "hook",
  },
};
const res = await fetch(`${api}/reviewers/decisions/open`, {
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
