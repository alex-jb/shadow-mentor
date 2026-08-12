#!/usr/bin/env node
// bin/shadow-research-check.mjs
//
// The mechanical grounding check behind the shadow-deep-research skill. Feed it a
// research memo (file arg or stdin); it labels every citation IN_FORCE / WITHDRAWN
// / EVIDENCE_INSUFFICIENT against the checked-in citation registry.
//
//   node bin/shadow-research-check.mjs memo.md
//   cat memo.md | node bin/shadow-research-check.mjs
//   node bin/shadow-research-check.mjs memo.md --json
//
// Exit codes: 0 = no ungrounded (invented) citations · 1 = at least one
// EVIDENCE_INSUFFICIENT citation · 2 = usage · 3 = I/O.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { groundResearchMemo } from "../lib/research-grounding.js";

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  process.stdout.write("Usage: shadow-research-check <memo.md|-> [--json]\n");
  process.exit(0);
}
const json = args.includes("--json");
const fileArg = args.find((a) => !a.startsWith("--"));

let text;
try {
  text = (!fileArg || fileArg === "-")
    ? readFileSync(0, "utf8")
    : readFileSync(resolve(fileArg), "utf8");
} catch (err) {
  process.stderr.write(`failed to read memo: ${err.message}\n`);
  process.exit(3);
}

const result = groundResearchMemo(text);

if (json) {
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exit(result.ok ? 0 : 1);
}

const fmt = (arr, tag, extra = () => "") =>
  arr.map((x) => `  ${tag}  ${x.id ?? x}${extra(x)}`).join("\n");

process.stdout.write("Shadow research grounding check\n");
if (result.in_force.length)
  process.stdout.write("\nIN_FORCE\n" + fmt(result.in_force, "✓") + "\n");
if (result.withdrawn.length)
  process.stdout.write("\nWITHDRAWN — do not cite as binding\n" +
    fmt(result.withdrawn, "⚠", (x) => x.sunset ? `  (sunset ${x.sunset})` : "") + "\n");
if (result.ungrounded.length)
  process.stdout.write("\nEVIDENCE_INSUFFICIENT — resolves to no registry entry\n" +
    result.ungrounded.map((u) => `  ✗  ${u}`).join("\n") + "\n");

process.stdout.write(
  `\nSummary: ${result.summary.in_force} in force · ${result.summary.withdrawn} withdrawn · ` +
  `${result.summary.ungrounded} ungrounded → ${result.ok ? "OK" : "REWORK (ungrounded citations)"}\n`,
);
process.exit(result.ok ? 0 : 1);
