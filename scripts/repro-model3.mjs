#!/usr/bin/env node
// scripts/repro-model3.mjs  —  `npm run repro:model3`
// One-command reproducibility artifact for Model 3 (audit completeness + evidence
// lineage + first-failure localization) from the Katz AY2026-2027 proposal. Runs the
// shipped sample bundle through auditLineageScore for both the untampered and the
// verdict-flipped case, prints the exact result table from docs/model3-audit-lineage-
// preliminary.md, and EXITS NONZERO if the numbers drift — so "preliminary work, not
// future work" is a claim a reviewer can check with one line, not a repo clone + guess.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { auditLineageScore } from "../lib/audit-lineage.js";

const R = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const D = resolve(R, "demos/adverse-action");
const bundle = JSON.parse(readFileSync(resolve(D, "sample-bundle.json"), "utf8"));
const pub = readFileSync(resolve(D, "sample-bundle.pub.pem"), "utf8");

const clean = auditLineageScore(bundle, { publicKey: pub });
const t = JSON.parse(JSON.stringify(bundle));
t.events.find((e) => e.payload && e.payload.kind === "council_verdict").payload.final_verdict = "approve";
const tampered = auditLineageScore(t, { publicKey: pub });

const f = (x) => (typeof x === "number" ? x.toFixed(2) : String(x));
const row = (label, m) =>
  `  ${label.padEnd(26)} ${String(m.integrityOk ? "✓" : "✗").padEnd(3)} ${f(m.auditCompleteness).padEnd(6)} ${f(m.lineageConnectivity).padEnd(6)} ${f(m.disconnectedRate).padEnd(7)} ${f(m.lineageDepthNormalized).padEnd(7)} ${String(m.firstFailureSeq ?? "—").padEnd(6)} ${f(m.failInvalidatedProportion).padEnd(7)} ${f(m.unifiedScore)}`;

console.log("Model 3 — audit completeness + evidence lineage (sample denied-loan bundle, 5 events)\n");
console.log(`  ${"case".padEnd(26)} ${"int".padEnd(3)} ${"A_cov".padEnd(6)} ${"C_lin".padEnd(6)} ${"R_disc".padEnd(7)} ${"D_norm".padEnd(7)} ${"first".padEnd(6)} ${"P_fail".padEnd(7)} A_total`);
console.log(row("untampered", clean));
console.log(row("verdict flipped @ seq 2", tampered));

// Assert the published result — this is what makes the artifact self-checking.
const problems = [];
const eq = (name, got, want) => { if (got !== want) problems.push(`${name}: got ${got}, expected ${want}`); };
eq("clean.integrityOk", clean.integrityOk, true);
eq("clean.sourceResolution", clean.sourceResolution, "VERIFIED");
eq("clean.unifiedScore", clean.unifiedScore, 1);
eq("clean.disconnectedRate", clean.disconnectedRate, 0);
eq("tampered.integrityOk", tampered.integrityOk, false);
eq("tampered.firstFailureSeq", tampered.firstFailureSeq, 2);
eq("tampered.firstFailureReason", tampered.firstFailureReason, "payload_hash_mismatch");
eq("tampered.unifiedScore", tampered.unifiedScore, 0);

if (problems.length) {
  console.error("\n✗ DRIFT — Model 3 numbers changed:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("\n✓ Reproduced: untampered A_total = 1.00; verdict-flip → 0.00, integrity false, localized at seq 2.");
