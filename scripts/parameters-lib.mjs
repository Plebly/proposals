/**
 * Single source of truth helpers for parameters.json.
 * Shared by sync-parameters, tests, and sibling repo codegen.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PROPOSALS_ROOT = join(__dirname, "..");
export const PARAMETERS_JSON_PATH = join(PROPOSALS_ROOT, "parameters.json");

/** @typedef {"signet" | "mainnet"} PleblyNetwork */

/**
 * @typedef {object} SharedParams
 * @property {number} submission_fee_sats
 * @property {number} platform_fee_percent
 * @property {number} milestone_threshold_sats
 * @property {number} claim_window_days
 * @property {number} claim_extension_days
 * @property {number} delivery_window_days
 * @property {string} proposal_type_default
 * @property {number} funding_window_days
 * @property {number} funding_window_extension_days
 * @property {number} idle_claimable_ballot_days
 * @property {number} badge_notable_sats
 * @property {number} badge_major_sats
 * @property {number} badge_patron_sats
 * @property {number} submission_fee_confirmations
 * @property {number} funding_confirmations
 * @property {number} completion_finality_confirmations
 * @property {number} core_annual_gap_sats
 * @property {number} claim_bond_sats
 * @property {number} max_active_claims
 * @property {number} claim_pending_ttl_hours
 * @property {number} reclaim_cooldown_days
 * @property {number} claim_checkpoint_day
 * @property {number} claim_checkpoint_grace_days
 * @property {number} claim_abuse_escalation_threshold
 * @property {number} max_site_claim_prs_per_day
 * @property {number} identity_relink_cooldown_days
 */

/**
 * @typedef {SharedParams & {
 *   claim_floor_sats: number,
 *   submission_fee_address: string | null,
 *   claim_floor_note?: string,
 *   network: PleblyNetwork,
 * }} ResolvedParams
 */

export function loadParametersJson(path = PARAMETERS_JSON_PATH) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}`);
  }
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (raw.schema_version !== 1) {
    throw new Error(`Unsupported parameters schema_version: ${raw.schema_version}`);
  }
  if (!raw.shared || !raw.networks?.signet || !raw.networks?.mainnet) {
    throw new Error("parameters.json must include shared + networks.signet/mainnet");
  }
  return raw;
}

/** @param {string | undefined | null} raw */
export function resolveNetwork(raw) {
  const n = String(raw || "signet").toLowerCase();
  return n === "mainnet" || n === "bitcoin" ? "mainnet" : "signet";
}

/**
 * @param {ReturnType<typeof loadParametersJson>} doc
 * @param {string | undefined | null} network
 * @returns {ResolvedParams}
 */
export function resolveParameters(doc, network) {
  const net = resolveNetwork(network);
  const overlay = doc.networks[net];
  if (typeof overlay.claim_floor_sats !== "number") {
    throw new Error(`networks.${net}.claim_floor_sats is required`);
  }
  return {
    ...doc.shared,
    claim_floor_sats: overlay.claim_floor_sats,
    submission_fee_address: overlay.submission_fee_address ?? null,
    claim_floor_note: overlay.claim_floor_note,
    network: net,
  };
}

/** @param {number} n */
export function formatSats(n) {
  return `${Number(n).toLocaleString("en-US")} sats`;
}

/**
 * Emit TypeScript module consumed by workers (both networks + helpers).
 * @param {ReturnType<typeof loadParametersJson>} doc
 */
export function emitWorkersParametersTs(doc) {
  const signet = resolveParameters(doc, "signet");
  const mainnet = resolveParameters(doc, "mainnet");
  const body = (p) => `{
  submission_fee_sats: ${p.submission_fee_sats},
  platform_fee_percent: ${p.platform_fee_percent},
  milestone_threshold_sats: ${p.milestone_threshold_sats},
  claim_floor_sats: ${p.claim_floor_sats},
  claim_window_days: ${p.claim_window_days},
  claim_extension_days: ${p.claim_extension_days},
  delivery_window_days: ${p.delivery_window_days},
  proposal_type_default: ${JSON.stringify(p.proposal_type_default)},
  funding_window_days: ${p.funding_window_days},
  funding_window_extension_days: ${p.funding_window_extension_days},
  idle_claimable_ballot_days: ${p.idle_claimable_ballot_days},
  badge_notable_sats: ${p.badge_notable_sats},
  badge_major_sats: ${p.badge_major_sats},
  badge_patron_sats: ${p.badge_patron_sats},
  submission_fee_confirmations: ${p.submission_fee_confirmations},
  funding_confirmations: ${p.funding_confirmations},
  completion_finality_confirmations: ${p.completion_finality_confirmations},
  core_annual_gap_sats: ${p.core_annual_gap_sats},
  claim_bond_sats: ${p.claim_bond_sats},
  max_active_claims: ${p.max_active_claims},
  claim_pending_ttl_hours: ${p.claim_pending_ttl_hours},
  reclaim_cooldown_days: ${p.reclaim_cooldown_days},
  claim_checkpoint_day: ${p.claim_checkpoint_day},
  claim_checkpoint_grace_days: ${p.claim_checkpoint_grace_days},
  claim_abuse_escalation_threshold: ${p.claim_abuse_escalation_threshold},
  max_site_claim_prs_per_day: ${p.max_site_claim_prs_per_day},
  identity_relink_cooldown_days: ${p.identity_relink_cooldown_days},
  submission_fee_address: ${JSON.stringify(p.submission_fee_address)},
}`;

  return `/* Auto-generated from proposals/parameters.json — do not edit.
 * Run: node ../proposals/scripts/sync-parameters.mjs
 */
export type PleblyNetwork = "signet" | "mainnet";

export type NetworkParameters = {
  submission_fee_sats: number;
  platform_fee_percent: number;
  milestone_threshold_sats: number;
  claim_floor_sats: number;
  claim_window_days: number;
  claim_extension_days: number;
  delivery_window_days: number;
  proposal_type_default: string;
  funding_window_days: number;
  funding_window_extension_days: number;
  idle_claimable_ballot_days: number;
  badge_notable_sats: number;
  badge_major_sats: number;
  badge_patron_sats: number;
  submission_fee_confirmations: number;
  funding_confirmations: number;
  completion_finality_confirmations: number;
  core_annual_gap_sats: number;
  claim_bond_sats: number;
  max_active_claims: number;
  claim_pending_ttl_hours: number;
  reclaim_cooldown_days: number;
  claim_checkpoint_day: number;
  claim_checkpoint_grace_days: number;
  claim_abuse_escalation_threshold: number;
  max_site_claim_prs_per_day: number;
  identity_relink_cooldown_days: number;
  submission_fee_address: string | null;
};

export const NETWORK_PARAMETERS: Record<PleblyNetwork, NetworkParameters> = {
  signet: ${body(signet)},
  mainnet: ${body(mainnet)},
};

export function resolveNetwork(raw?: string | null): PleblyNetwork {
  const n = String(raw || "signet").toLowerCase();
  return n === "mainnet" || n === "bitcoin" ? "mainnet" : "signet";
}

export function paramsFor(network?: string | null): NetworkParameters {
  return NETWORK_PARAMETERS[resolveNetwork(network)];
}
`;
}

/**
 * Emit flat constants for one network (plebly.fund build).
 * @param {ResolvedParams} p
 */
export function emitFundParametersTs(p) {
  return `/* Auto-generated from proposals/parameters.json — do not edit */
export const SUBMISSION_FEE_SATS = ${p.submission_fee_sats};
export const CLAIM_FLOOR_SATS = ${p.claim_floor_sats};
export const MILESTONE_THRESHOLD_SATS = ${p.milestone_threshold_sats};
export const PLATFORM_FEE_PERCENT = ${p.platform_fee_percent};
export const CLAIM_BOND_SATS = ${p.claim_bond_sats};
export const MAX_ACTIVE_CLAIMS = ${p.max_active_claims};
export const CLAIM_PENDING_TTL_HOURS = ${p.claim_pending_ttl_hours};
export const RECLAIM_COOLDOWN_DAYS = ${p.reclaim_cooldown_days};
export const CLAIM_CHECKPOINT_DAY = ${p.claim_checkpoint_day};
export const CLAIM_CHECKPOINT_GRACE_DAYS = ${p.claim_checkpoint_grace_days};
export const CLAIM_ABUSE_ESCALATION_THRESHOLD = ${p.claim_abuse_escalation_threshold};
export const CORE_ANNUAL_GAP_SATS = ${p.core_annual_gap_sats};
export const MAX_SITE_CLAIM_PRS_PER_DAY = ${p.max_site_claim_prs_per_day};
export const IDENTITY_RELINK_COOLDOWN_DAYS = ${p.identity_relink_cooldown_days};
export const CLAIM_WINDOW_DAYS = ${p.claim_window_days};
export const CLAIM_EXTENSION_DAYS = ${p.claim_extension_days};
export const FUNDING_WINDOW_DAYS = ${p.funding_window_days};
export const FUNDING_WINDOW_EXTENSION_DAYS = ${p.funding_window_extension_days};
export const DELIVERY_WINDOW_DAYS = ${p.delivery_window_days};
export const FUNDING_CONFIRMATIONS = ${p.funding_confirmations};
export const BADGE_NOTABLE_SATS = ${p.badge_notable_sats};
export const BADGE_MAJOR_SATS = ${p.badge_major_sats};
export const BADGE_PATRON_SATS = ${p.badge_patron_sats};
export const PLEBLY_PARAMETERS_NETWORK = ${JSON.stringify(p.network)} as const;
`;
}

/**
 * Render markdown tables for PARAMETERS.md (between sync markers).
 * @param {ReturnType<typeof loadParametersJson>} doc
 */
export function renderParametersMarkdownTables(doc) {
  const s = doc.shared;
  const signet = resolveParameters(doc, "signet");
  const mainnet = resolveParameters(doc, "mainnet");

  return `## Section VII (launch-locked)

| Parameter | Value |
|-----------|-------|
| Submission fee | ${formatSats(s.submission_fee_sats)} (exact, non-refundable) |
| Platform fee | ${s.platform_fee_percent}% of escrow to Plebly at successful disbursement |
| Milestone threshold | ${formatSats(s.milestone_threshold_sats)} |
| Claim window | ${s.claim_window_days} days from claim acceptance |
| Claim extension | One ${s.claim_extension_days}-day extension via reviewer supermajority |
| Delivery window (direct proposals) | ${s.delivery_window_days} days from escrow allocation |
| Proposal type default | \`${s.proposal_type_default}\` (missing field → bounty) |

### Claim floor by network

| Network | Claim floor | Notes |
|---------|-------------|-------|
| Signet | ${formatSats(signet.claim_floor_sats)} | ${signet.claim_floor_note || "Testing"} |
| Mainnet | ${formatSats(mainnet.claim_floor_sats)} | Launch minimum |

Machine-readable source: [\`parameters.json\`](./parameters.json). Edit that file, then run \`npm run parameters:sync\`.

## Ratified (pre-launch process defaults)

| Parameter | Value |
|-----------|-------|
| Active funding window (Q5) | ${s.funding_window_days} days from escrow address allocation |
| Funding window extension (Q5) | One ${s.funding_window_extension_days}-day extension via reviewer vote |
| Idle claimable → contributor ballot (Q54) | ${s.idle_claimable_ballot_days} days with no claim → \`abandoned_vote\` |
| Redirect / underfunded ballot (Q18) | Options \`extend\` \\| \`refund\` \\| \`redirect:<id>\`; 1 claimed contributor identity = 1 vote; quorum = majority of distinct contributors (or all if &lt;3) |
| Badge: Notable Contributor | ${formatSats(s.badge_notable_sats)} (per proposal) |
| Badge: Major Contributor | ${formatSats(s.badge_major_sats)} |
| Badge: Patron | ${formatSats(s.badge_patron_sats)} |
| Submission fee confirmations | ${s.submission_fee_confirmations} |
| Funding / badge / vote confirmations | ${s.funding_confirmations} |
| Completion finality confirmations | ${s.completion_finality_confirmations} |
| Core annual gap | ${formatSats(s.core_annual_gap_sats)} |

Signet fee/bond receive (live): \`${signet.submission_fee_address || "TBD"}\` (Workers \`TEST_SUBMISSION_FEE_ADDRESS\`, CI \`vars.SUBMISSION_FEE_ADDRESS\`). Mainnet fee address remains TBD until ops publishes a \`bc1…\` (Workers \`SUBMISSION_FEE_ADDRESS\`).

## Claim abuse mitigations (provisional)

See \`plebly.fund/docs/claim-abuse-mitigations.md\` (risk register). Changes require the same public process and thirty-day notice.

| Parameter | Proposed default |
|-----------|------------------|
| Claim bond | ${formatSats(s.claim_bond_sats)} (exact, to submission-fee / ops fee address) |
| Max active claims | ${s.max_active_claims} (pending + exclusive claimed / in_review) |
| Claim pending TTL | ${s.claim_pending_ttl_hours} hours |
| Reclaim cooldown | ${s.reclaim_cooldown_days} days (after expiry, final_rejected, or abandoned release) |
| Claim checkpoint day | ${s.claim_checkpoint_day} (from claim acceptance) |
| Claim checkpoint grace | ${s.claim_checkpoint_grace_days} days |
| Claim abuse escalation threshold | ${s.claim_abuse_escalation_threshold} (expired/abandoned without completion → 2× bond) |
| Max site claim PRs per day | ${s.max_site_claim_prs_per_day} (Worker global) |
| Identity relink cooldown | ${s.identity_relink_cooldown_days} days |
`;
}
