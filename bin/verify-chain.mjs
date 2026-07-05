#!/usr/bin/env node
// bin/verify-chain.mjs
// ──────────────────────────────────────────────────────────────────
// CLI verifier for Shadow attestation chain integrity.
//
// Auditor runs this against a JSONL audit log; every line is either
// an attestation object OR a persisted response envelope with a
// `.response.attestation` field. Extracts attestations in file order
// and asserts chain integrity.
//
// Usage
// -----
//     node bin/verify-chain.mjs --log audit-log.jsonl
//     node bin/verify-chain.mjs --log audit-log.jsonl --field response.attestation
//
// Exit codes
// ----------
//     0 = chain intact (auditor sees green ✓)
//     1 = chain broken (auditor sees red ✗ + broken_at_index)
//     2 = argument / IO error

import { readFileSync } from "node:fs";
import { verifyChain } from "../lib/attestation-chain.js";

function usage(msg) {
  if (msg) console.error(`error: ${msg}\n`);
  console.error(
`Usage:
  node bin/verify-chain.mjs --log <path.jsonl> [--field <dot.path>]

Options:
  --log <path>     Path to a JSONL file. Each line is either an attestation
                   object OR a persisted envelope (see --field).
  --field <path>   Dot-path to the attestation inside each envelope
                   (default: "response.attestation"). Use "" to treat
                   each line as a raw attestation.

Exit codes:
  0 — chain intact
  1 — chain broken
  2 — argument / IO error`);
  process.exit(msg ? 2 : 0);
}

function extractField(obj, path) {
  if (!path) return obj;
  return path.split(".").reduce((cur, key) => (cur == null ? cur : cur[key]), obj);
}

function parseArgs(argv) {
  const opts = { log: null, field: "response.attestation" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") usage();
    else if (a === "--log") opts.log = argv[++i] ?? usage("--log needs a value");
    else if (a === "--field") opts.field = argv[++i];
    else usage(`unknown flag ${a}`);
  }
  if (!opts.log) usage("--log is required");
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  let text;
  try {
    text = readFileSync(opts.log, "utf8");
  } catch (e) {
    console.error(`Cannot read log file: ${e.message}`);
    process.exit(2);
  }

  const attestations = [];
  const lines = text.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      console.error(`✗ malformed JSONL line: ${line.slice(0, 80)}`);
      process.exit(2);
    }
    const att = extractField(parsed, opts.field);
    if (!att) {
      console.error(
        `✗ line ${attestations.length + 1} has no attestation at ` +
        `field "${opts.field}" — check --field or the log shape`
      );
      process.exit(2);
    }
    attestations.push(att);
  }

  const result = verifyChain(attestations);

  if (result.ok) {
    console.log(`✓ chain intact`);
    console.log(`  length:          ${result.length}`);
    console.log(`  links_verified:  ${result.links_verified}`);
    console.log(`  reason:          ${result.reason}`);
    process.exit(0);
  }

  console.log(`✗ chain COMPROMISED`);
  console.log(`  length:          ${result.length}`);
  console.log(`  broken_at_index: ${result.broken_at_index}`);
  console.log(`  links_verified:  ${result.links_verified}`);
  console.log(`  reason:          ${result.reason}`);
  console.log();
  console.log(`Records at index ${result.broken_at_index} and later cannot be trusted for audit purposes.`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
