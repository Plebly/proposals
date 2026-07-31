#!/usr/bin/env node
/**
 * Sync parameters.json → PARAMETERS.md tables + sibling generated TS.
 *
 * Usage:
 *   node scripts/sync-parameters.mjs           # write
 *   node scripts/sync-parameters.mjs --check   # exit 1 on drift
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PROPOSALS_ROOT,
  loadParametersJson,
  resolveParameters,
  emitWorkersParametersTs,
  emitFundParametersTs,
  renderParametersMarkdownTables,
  resolveNetwork,
} from "./parameters-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const check = process.argv.includes("--check");

const START = "<!-- parameters:generated:start -->";
const END = "<!-- parameters:generated:end -->";

function replaceMarkedSection(md, body) {
  const start = md.indexOf(START);
  const end = md.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `PARAMETERS.md must contain ${START} … ${END} markers`,
    );
  }
  return (
    md.slice(0, start + START.length) +
    "\n\n" +
    body.trim() +
    "\n\n" +
    md.slice(end)
  );
}

function writeOrCheck(path, contents) {
  const next = contents.endsWith("\n") ? contents : `${contents}\n`;
  if (check) {
    if (!existsSync(path)) {
      console.error(`Missing ${path} (run npm run parameters:sync)`);
      process.exitCode = 1;
      return;
    }
    const prev = readFileSync(path, "utf8");
    if (prev !== next) {
      console.error(`Drift: ${path}`);
      process.exitCode = 1;
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next);
  console.log(`Wrote ${path}`);
}

function main() {
  const doc = loadParametersJson();
  const mdPath = join(PROPOSALS_ROOT, "PARAMETERS.md");
  const md = readFileSync(mdPath, "utf8");
  const tables = renderParametersMarkdownTables(doc);
  writeOrCheck(mdPath, replaceMarkedSection(md, tables));

  const workersRoot = join(PROPOSALS_ROOT, "../workers");
  if (existsSync(workersRoot)) {
    writeOrCheck(
      join(workersRoot, "src/generated/parameters.ts"),
      emitWorkersParametersTs(doc),
    );
  } else if (check) {
    console.warn("skip workers generated check (sibling not checked out)");
  }

  // Fund regenerates at site build from parameters.json; sync writes a local
  // copy when the sibling exists (gitignored in plebly.fund).
  const fundRoot = join(PROPOSALS_ROOT, "../plebly.fund");
  if (existsSync(fundRoot)) {
    const fundNetwork = resolveNetwork(
      process.env.VITE_BITCOIN_NETWORK ||
        process.env.BITCOIN_NETWORK ||
        "signet",
    );
    writeOrCheck(
      join(fundRoot, "src/generated/parameters.ts"),
      emitFundParametersTs(resolveParameters(doc, fundNetwork)),
    );
  } else if (check) {
    console.warn("skip plebly.fund generated check (sibling not checked out)");
  }

  if (check && !process.exitCode) {
    console.log("parameters sync OK");
  }
}

main();
