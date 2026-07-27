#!/usr/bin/env node
/**
 * CI merge-gate: submission fee / claim bond txids pay exact amount to fee address.
 * Fee address from repo var SUBMISSION_FEE_ADDRESS (never parse PARAMETERS TBD).
 *
 * Env:
 *   SUBMISSION_FEE_ADDRESS — required (repo variable)
 *   SUBMISSION_FEE_SATS — default 10000
 *   CLAIM_BOND_SATS — default 10000
 *   MEMPOOL_API — e.g. https://mempool.space/signet/api or https://mempool.space/api
 *   BITCOIN_NETWORK — signet | mainnet (affects confirmed requirement)
 *
 * Signet note: all-zero submission_fee_txid is allowed only for the seed/demo
 * allowlist below. New listings need a real 10k payment. Mainnet rejects zeros.
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const feeAddress = (process.env.SUBMISSION_FEE_ADDRESS || "").trim();
const feeSats = Number(process.env.SUBMISSION_FEE_SATS || 10_000);
const bondSats = Number(process.env.CLAIM_BOND_SATS || 10_000);
const mempoolApi = (
  process.env.MEMPOOL_API ||
  (process.env.BITCOIN_NETWORK === "mainnet"
    ? "https://mempool.space/api"
    : "https://mempool.space/signet/api")
).replace(/\/$/, "");
const mainnet = (process.env.BITCOIN_NETWORK || "signet") === "mainnet";

/** Basename allowlist for historical seed demos (signet only). */
const ZERO_TXID_ALLOWLIST = new Set([
  "demo-signet-smoke.md",
  "knots-size-value-spam.md",
]);

function allowsZeroFeeTxid(file) {
  return ZERO_TXID_ALLOWLIST.has(path.basename(file));
}

const files = process.argv.slice(2).filter((f) => f.endsWith(".md"));

if (!feeAddress) {
  console.error(
    "SUBMISSION_FEE_ADDRESS repo variable required (do not use PARAMETERS TBD)",
  );
  process.exit(1);
}

if (files.length === 0) {
  console.log("No proposal files to fee-check.");
  process.exit(0);
}

async function getTx(txid) {
  const res = await fetch(`${mempoolApi}/tx/${txid}`);
  if (!res.ok) throw new Error(`mempool ${res.status} for ${txid}`);
  return res.json();
}

function paidToFee(tx) {
  return (tx.vout || [])
    .filter((o) => o.scriptpubkey_address === feeAddress)
    .reduce((s, o) => s + (o.value || 0), 0);
}

let failed = 0;

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const { data } = matter(fs.readFileSync(file, "utf8"));
  const status = String(data.status || "");

  if (data.submission_fee_txid) {
    const txid = String(data.submission_fee_txid);
    if (/^0{64}$/.test(txid)) {
      if (mainnet) {
        console.error(`${file}: zero submission_fee_txid not allowed on mainnet`);
        failed++;
      } else if (!allowsZeroFeeTxid(file)) {
        console.error(
          `${file}: zero submission_fee_txid only allowed for seed demos (${[...ZERO_TXID_ALLOWLIST].join(", ")}) — pay exact ${feeSats} sats to ${feeAddress}`,
        );
        failed++;
      } else {
        console.warn(
          `${file}: signet seed placeholder fee txid (all zeros) — replace with a real 10k payment before mainnet`,
        );
      }
      continue;
    }
    try {
      const tx = await getTx(txid);
      if (mainnet && !tx.status?.confirmed) {
        console.error(`${file}: submission fee tx not confirmed`);
        failed++;
      } else {
        const paid = paidToFee(tx);
        if (paid !== feeSats) {
          console.error(
            `${file}: submission fee must be exact ${feeSats} sats to ${feeAddress} (got ${paid})`,
          );
          failed++;
        } else {
          console.log(`${file}: submission fee ok`);
        }
      }
    } catch (e) {
      console.error(`${file}: submission fee check failed: ${e.message}`);
      failed++;
    }
  }

  if (status === "claimed" || data.claimer || data.claim_bond_txid) {
    const txid = data.claim_bond_txid ? String(data.claim_bond_txid) : "";
    if (!/^[0-9a-fA-F]{64}$/.test(txid)) {
      console.error(
        `${file}: claim_bond_txid required when introducing claimed status`,
      );
      failed++;
    } else {
      try {
        const tx = await getTx(txid);
        if (mainnet && !tx.status?.confirmed) {
          console.error(`${file}: claim bond tx not confirmed`);
          failed++;
        } else {
          const paid = paidToFee(tx);
          if (paid !== bondSats && paid !== bondSats * 2) {
            console.error(
              `${file}: claim bond must be exact ${bondSats} (or 2× escalated) sats to ${feeAddress} (got ${paid})`,
            );
            failed++;
          } else {
            console.log(`${file}: claim bond ok`);
          }
        }
      } catch (e) {
        console.error(`${file}: claim bond check failed: ${e.message}`);
        failed++;
      }
    }
  }
}

if (failed) {
  console.error(`Fee checks failed: ${failed}`);
  process.exit(1);
}
console.log("Fee checks passed.");
