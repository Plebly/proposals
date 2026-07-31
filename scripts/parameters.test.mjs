import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  loadParametersJson,
  resolveNetwork,
  resolveParameters,
  emitWorkersParametersTs,
  emitFundParametersTs,
} from "./parameters-lib.mjs";

describe("parameters.json", () => {
  const doc = loadParametersJson();

  it("resolves signet vs mainnet claim floors", () => {
    const signet = resolveParameters(doc, "signet");
    const mainnet = resolveParameters(doc, "mainnet");
    assert.equal(signet.network, "signet");
    assert.equal(mainnet.network, "mainnet");
    assert.equal(signet.claim_floor_sats, 10_000);
    assert.equal(mainnet.claim_floor_sats, 100_000);
    assert.equal(signet.submission_fee_sats, mainnet.submission_fee_sats);
  });

  it("maps bitcoin → mainnet", () => {
    assert.equal(resolveNetwork("bitcoin"), "mainnet");
    assert.equal(resolveNetwork("SIGNET"), "signet");
  });

  it("emits workers + fund TypeScript", () => {
    const w = emitWorkersParametersTs(doc);
    assert.match(w, /NETWORK_PARAMETERS/);
    assert.match(w, /claim_floor_sats: 10000/);
    assert.match(w, /claim_floor_sats: 100000/);
    const f = emitFundParametersTs(resolveParameters(doc, "signet"));
    assert.match(f, /export const CLAIM_FLOOR_SATS = 10000/);
  });
});
