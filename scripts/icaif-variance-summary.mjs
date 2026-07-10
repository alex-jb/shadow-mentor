#!/usr/bin/env node
// scripts/icaif-variance-summary.mjs
//
// Consolidates all summary-*.json files in benchmark/icaif-2026/ into a
// single variance-envelope summary: mean + std of verdict-accuracy,
// per-voice-agreement, and AA-code-coverage across seeds.
//
// Usage:
//   node scripts/icaif-variance-summary.mjs

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(__dirname, "..", "benchmark", "icaif-2026");

const files = readdirSync(DIR).filter(f => /^summary-\d+\.json$/.test(f));
if (files.length < 2) {
  console.error(`Need at least 2 summary files in ${DIR}; found ${files.length}.`);
  process.exit(1);
}

const summaries = files.map(f => JSON.parse(readFileSync(resolve(DIR, f), "utf8")));
summaries.sort((a, b) => a.seed - b.seed);

function meanStd(arr) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  return { mean: +mean.toFixed(4), std: +Math.sqrt(variance).toFixed(4), n: arr.length };
}

const voices = Object.keys(summaries[0].per_voice_agreement_with_final);
const perVoiceEnvelope = Object.fromEntries(
  voices.map(v => [v, meanStd(summaries.map(s => s.per_voice_agreement_with_final[v]))])
);

const aaCodes = new Set();
for (const s of summaries) for (const k of Object.keys(s.aa_code_coverage)) aaCodes.add(k);
const aaEnvelope = Object.fromEntries(
  [...aaCodes].sort().map(code => [
    code,
    meanStd(summaries.map(s => s.aa_code_coverage[code] ?? 0)),
  ])
);

// Verdict-class distribution envelope
const classes = ["approve", "escalate", "block"];
const distEnvelope = Object.fromEntries(
  classes.map(cls => {
    const key = `${cls}→${cls}`;
    return [cls, meanStd(summaries.map(s => s.confusion_matrix[key] ?? 0))];
  })
);

const envelope = {
  generated_at_utc: new Date().toISOString(),
  seeds: summaries.map(s => s.seed),
  n_per_seed: summaries[0].n,
  total_decisions: summaries.length * summaries[0].n,
  verdict_accuracy_envelope: meanStd(summaries.map(s => s.verdict_accuracy)),
  verdict_class_distribution_envelope: distEnvelope,
  per_voice_agreement_envelope: perVoiceEnvelope,
  aa_code_coverage_envelope: aaEnvelope,
  notes: [
    `Envelope computed across ${summaries.length} independent seeds`,
    "verdict_accuracy std is 0 by construction: gold-labels derive from the same LOAN_DEFAULTS the council uses; both apply the policy deterministically",
    "per_voice_agreement std is the signal: shows how much each persona's independence-vs-final agreement varies with sample composition",
    "per_voice_confidence std is 0 by construction: confidence is a per-persona constant; this IS the schema gap the ICAIF paper Section 3.2 must address",
  ],
};

const outFile = resolve(DIR, "variance-envelope.json");
writeFileSync(outFile, JSON.stringify(envelope, null, 2) + "\n");
console.log(`Wrote variance envelope over ${summaries.length} seeds to ${outFile}`);
console.log("");
console.log(`Verdict accuracy: ${envelope.verdict_accuracy_envelope.mean} ± ${envelope.verdict_accuracy_envelope.std}`);
console.log(`Per-voice agreement envelope:`);
for (const [v, o] of Object.entries(perVoiceEnvelope)) {
  console.log(`  ${v.padEnd(24)}: ${o.mean.toFixed(3)} ± ${o.std.toFixed(3)}`);
}
