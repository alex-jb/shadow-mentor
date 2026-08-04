// Model 3 (audit completeness + evidence lineage + first-failure localization) over the
// shipped bundle. Pins that the unified score is a real, monotone measure: a perfect bundle
// scores 1.0; a plaintext tamper both fails integrity AND drops the score, localized to the
// exact seq; missing required evidence lowers weighted completeness. This is the citable
// preliminary work for the Katz proposal's Model 3 + evaluation table.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { auditLineageScore } from "../lib/audit-lineage.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLE = JSON.parse(readFileSync(resolve(ROOT, "demos/adverse-action/sample-bundle.json"), "utf8"));
const PUB = readFileSync(resolve(ROOT, "demos/adverse-action/sample-bundle.pub.pem"), "utf8");
const clone = () => JSON.parse(JSON.stringify(BUNDLE));

test("a clean, fully-covered bundle scores A_total = 1.0 with full connectivity", () => {
  const m = auditLineageScore(BUNDLE, { publicKey: PUB });
  assert.equal(m.integrityOk, true);
  assert.equal(m.sourceResolution, "VERIFIED");
  assert.equal(m.lineageConnectivity, 1);
  assert.equal(m.disconnectedRate, 0);
  assert.equal(m.failInvalidatedProportion, 0);
  assert.equal(m.firstFailureSeq, null);
  assert.equal(m.unifiedScore, 1);
});

test("a plaintext tamper localizes the first failure and drops the score", () => {
  const b = clone();
  const idx = b.events.findIndex((e) => e.payload && e.payload.kind === "council_verdict"); // seq 2
  b.events[idx].payload.final_verdict = "approve";
  const m = auditLineageScore(b, { publicKey: PUB });
  assert.equal(m.integrityOk, false);
  assert.equal(m.firstFailureSeq, idx, "first-failure localization must name the edited seq");
  assert.equal(m.firstFailureReason, "payload_hash_mismatch");
  // everything from the edited event onward is invalidated + disconnected
  const n = b.events.length;
  assert.equal(m.failInvalidatedProportion, (n - idx) / n);
  assert.equal(m.lineageConnectivity, idx / n);
  assert.ok(m.unifiedScore < 1, "a tampered bundle must score below a clean one");
});

test("weighted audit completeness A_cov reflects the required-evidence set + weights", () => {
  // R with 4 required items, one unverified; weight the unverified one heavily.
  const required = [
    { id: "integrity", weight: 2, verified: true },
    { id: "decision_outcome", weight: 1, verified: true },
    { id: "reason_codes", weight: 1, verified: true },
    { id: "human_approval", weight: 4, verified: false },
  ];
  const m = auditLineageScore(BUNDLE, { publicKey: PUB, required });
  // weighted: (2+1+1)/(2+1+1+4) = 4/8 = 0.5 ; unweighted: 3/4 = 0.75
  assert.equal(m.auditCompleteness, 0.5);
  assert.equal(m.auditCompletenessUnweighted, 0.75);
  assert.equal(m.requiredCount, 4);
  assert.equal(m.verifiedCount, 3);
});

test("missing all required evidence pushes A_cov to 0 (and the score down)", () => {
  const required = [
    { id: "a", verified: false },
    { id: "b", verified: false },
  ];
  const m = auditLineageScore(BUNDLE, { publicKey: PUB, required });
  assert.equal(m.auditCompleteness, 0);
  // integrity + lineage are still perfect, so the score is β·1 + γ·1 = 0.3 + 0.2 = 0.5
  assert.equal(m.unifiedScore, 0.5);
});

test("weights are overridable and a perfect bundle still tops out at 1.0", () => {
  const m = auditLineageScore(BUNDLE, { publicKey: PUB, weights: { alpha: 0.4, beta: 0.4, gamma: 0.2 } });
  assert.equal(m.unifiedScore, 1);
  assert.equal(m.weights.alpha, 0.4);
});
