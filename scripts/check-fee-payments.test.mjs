/**
 * Lightweight unit checks for fee-gate helpers (no network).
 * Run: node --test scripts/check-fee-payments.test.mjs
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

function paidToFee(tx, feeAddress) {
  return (tx.vout || [])
    .filter((o) => o.scriptpubkey_address === feeAddress)
    .reduce((s, o) => s + (o.value || 0), 0);
}

describe("check-fee-payments helpers", () => {
  it("sums exact outputs to fee address", () => {
    const addr = "tb1qfee";
    const paid = paidToFee(
      {
        vout: [
          { scriptpubkey_address: addr, value: 4_000 },
          { scriptpubkey_address: "tb1qother", value: 1_000 },
          { scriptpubkey_address: addr, value: 6_000 },
        ],
      },
      addr,
    );
    assert.equal(paid, 10_000);
  });

  it("returns 0 when fee address unpaid", () => {
    assert.equal(
      paidToFee(
        { vout: [{ scriptpubkey_address: "tb1qother", value: 10_000 }] },
        "tb1qfee",
      ),
      0,
    );
  });
});
