#!/usr/bin/env node
/** Ops: POST /contributions/claim/ops — bind confirmed donor credit. */
const api = (process.env.PLEBLY_API_URL || "").replace(/\/$/, "");
const secret = process.env.PLEBLY_HOOK_SECRET || "";
const proposalId = (process.env.PROPOSAL_ID || "").trim();
const userId = (process.env.USER_ID || "").trim();
if (!api || !secret || !proposalId || !userId) {
  console.error(
    "PLEBLY_API_URL, PLEBLY_HOOK_SECRET, PROPOSAL_ID, USER_ID required",
  );
  process.exit(1);
}
const body = {
  proposal_id: proposalId,
  user_id: userId,
};
if (process.env.IDENTITY) body.identity = process.env.IDENTITY.trim();
if (process.env.TXID) body.txid = process.env.TXID.trim();
if (process.env.VOUT !== undefined && process.env.VOUT !== "") {
  body.vout = Number(process.env.VOUT);
}
if (process.env.SWAP_ID) body.swap_id = process.env.SWAP_ID.trim();
const res = await fetch(`${api}/contributions/claim/ops`, {
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
