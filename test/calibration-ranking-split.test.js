// test/calibration-ranking-split.test.js
// v1.5.42 contract tests for the Bayesian calibration/ranking split.
// Directly targets SIVE Finding #3 from v1.5.41.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import {
  computeCalibratedProbability,
  computeRankingScore,
  computeCalibrationRankingSplit,
  calibrationRankingSplitCommitment,
  auditNoConflation,
} from "../lib/calibration-ranking-split.js";
import {
  buildAttestation, verifyAttestation, SIGNATURE_MODES,
} from "../lib/attestation.js";


const OBVIOUS_APPROVE_VOICES = [
  { voice_name: "Compliance Officer", verdict: "approve", confidence: 0.95, metrics: { credit_score: 780 } },
  { voice_name: "Credit Fundamentals", verdict: "approve", confidence: 0.95, metrics: { credit_score: 780 } },
  { voice_name: "Risk Officer", verdict: "approve", confidence: 0.90, metrics: {} },
  { voice_name: "Customer Advocate", verdict: "approve", confidence: 0.85, metrics: {} },
  { voice_name: "Macro Contrarian", verdict: "approve", confidence: 0.75, metrics: {} },
];

const BORDERLINE_VOICES = [
  { voice_name: "Compliance Officer", verdict: "approve", confidence: 0.55, metrics: { credit_score: 705 } },
  { voice_name: "Credit Fundamentals", verdict: "approve", confidence: 0.55, metrics: { credit_score: 705 } },
  { voice_name: "Risk Officer", verdict: "escalate", confidence: 0.60, metrics: {} },
  { voice_name: "Customer Advocate", verdict: "approve", confidence: 0.50, metrics: {} },
  { voice_name: "Macro Contrarian", verdict: "escalate", confidence: 0.55, metrics: {} },
];

const OBVIOUS_DENY_VOICES = [
  { voice_name: "Compliance Officer", verdict: "block", confidence: 0.98, metrics: { credit_score: 500 } },
  { voice_name: "Credit Fundamentals", verdict: "block", confidence: 0.98, metrics: { credit_score: 500 } },
  { voice_name: "Risk Officer", verdict: "block", confidence: 0.95, metrics: {} },
  { voice_name: "Customer Advocate", verdict: "block", confidence: 0.85, metrics: {} },
  { voice_name: "Macro Contrarian", verdict: "block", confidence: 0.90, metrics: {} },
];

const WEIGHTS = {
  "Compliance Officer": 1.20,
  "Credit Fundamentals": 1.10,
  "Risk Officer": 1.00,
  "Customer Advocate": 0.85,
  "Macro Contrarian": 0.85,
};


test("computeCalibratedProbability: returns [0,1] for empty input", () => {
  const p = computeCalibratedProbability([]);
  assert.equal(p, 0.5);
});


test("computeCalibratedProbability: obvious_approve ≈ 0.9", () => {
  const p = computeCalibratedProbability(OBVIOUS_APPROVE_VOICES, WEIGHTS);
  assert.ok(p >= 0.85 && p <= 0.95,
    `calibrated_p=${p} not in [0.85, 0.95]`);
});


test("computeCalibratedProbability: obvious_deny ≈ 0.1", () => {
  const p = computeCalibratedProbability(OBVIOUS_DENY_VOICES, WEIGHTS);
  assert.ok(p >= 0.05 && p <= 0.15,
    `calibrated_p=${p} not in [0.05, 0.15]`);
});


test("computeCalibratedProbability: borderline in middle band", () => {
  const p = computeCalibratedProbability(BORDERLINE_VOICES, WEIGHTS);
  assert.ok(p >= 0.60 && p <= 0.85,
    `calibrated_p=${p} not in middle band`);
});


test("computeRankingScore: obvious_approve > borderline > obvious_deny", () => {
  const rApprove = computeRankingScore(OBVIOUS_APPROVE_VOICES, WEIGHTS);
  const rBorderline = computeRankingScore(BORDERLINE_VOICES, WEIGHTS);
  const rDeny = computeRankingScore(OBVIOUS_DENY_VOICES, WEIGHTS);
  assert.ok(rApprove > rBorderline,
    `Rank violated: approve=${rApprove} borderline=${rBorderline}`);
  assert.ok(rBorderline > rDeny,
    `Rank violated: borderline=${rBorderline} deny=${rDeny}`);
});


test("SIVE FINDING #3 FIX: obvious_approve and borderline produce DIFFERENT ranking_scores", () => {
  // The whole point of v1.5.42 — SIVE showed that v1.5.41's
  // aggregated_score collapsed obvious_approve and borderline to the
  // SAME value (0.6575). The split must produce different values.
  const rApprove = computeRankingScore(OBVIOUS_APPROVE_VOICES, WEIGHTS);
  const rBorderline = computeRankingScore(BORDERLINE_VOICES, WEIGHTS);
  const delta = Math.abs(rApprove - rBorderline);
  assert.ok(delta >= 1.0,
    `Ranking-Calibration conflation NOT fixed: delta=${delta.toFixed(3)}`);
});


test("Same-verdict but different-signal loans produce different ranking_scores", () => {
  // The v1.5.41 SIVE Finding #3 pathology exposed: both loans have
  // all-approve verdicts, but obvious_approve is at FICO 780 while
  // borderline is at FICO 705. Ranking should reflect that.
  const rHigh = computeRankingScore(OBVIOUS_APPROVE_VOICES, WEIGHTS);
  const rBorderline = computeRankingScore(BORDERLINE_VOICES, WEIGHTS);
  assert.notEqual(rHigh, rBorderline,
    "Same verdict + different signal MUST produce different ranking");
});


test("computeCalibrationRankingSplit: returns both outputs", () => {
  const split = computeCalibrationRankingSplit(OBVIOUS_APPROVE_VOICES, WEIGHTS);
  assert.ok("calibrated_p" in split);
  assert.ok("ranking_score" in split);
  assert.ok(split.calibrated_p >= 0 && split.calibrated_p <= 1);
});


test("calibrationRankingSplitCommitment: deterministic + 64-char hex", () => {
  const split = computeCalibrationRankingSplit(OBVIOUS_APPROVE_VOICES, WEIGHTS);
  const a = calibrationRankingSplitCommitment(split, OBVIOUS_APPROVE_VOICES, WEIGHTS);
  const b = calibrationRankingSplitCommitment(split, OBVIOUS_APPROVE_VOICES, WEIGHTS);
  assert.equal(a, b);
  assert.equal(a.length, 64);
  assert.match(a, /^[0-9a-f]{64}$/);
});


test("auditNoConflation: detects variance collapse (Haiku uniform-0.5 pathology)", () => {
  const collapsedDecisions = Array(5).fill({ calibrated_p: 0.5, ranking_score: 0 });
  const audit = auditNoConflation(collapsedDecisions);
  assert.equal(audit.ok, false);
  assert.match(audit.reason, /Variance collapse/);
});


test("auditNoConflation: passes when two outputs vary independently", () => {
  const decisions = [
    { calibrated_p: 0.90, ranking_score: 5.0 },
    { calibrated_p: 0.90, ranking_score: 2.0 },  // same cal, diff rank
    { calibrated_p: 0.50, ranking_score: 5.0 },  // diff cal, same rank
    { calibrated_p: 0.10, ranking_score: -3.0 },
  ];
  const audit = auditNoConflation(decisions);
  assert.equal(audit.ok, true);
});


test("BINDING: attestation signs over calibration_ranking_split_sha256 (HMAC)", () => {
  const split = computeCalibrationRankingSplit(OBVIOUS_APPROVE_VOICES, WEIGHTS);
  const hash = calibrationRankingSplitCommitment(split, OBVIOUS_APPROVE_VOICES, WEIGHTS);
  const request = { loan: { fico: 720 } };
  const response = { verdict: "approve" };
  const att = buildAttestation({
    request, response,
    modelId: "claude-sonnet-4-6",
    secret: "test-secret",
    calibrationRankingSplitSha256: hash,
  });
  assert.equal(att.calibration_ranking_split_sha256, hash);
  const v = verifyAttestation(att, request, response, "test-secret");
  assert.equal(v.ok, true);
});


test("TAMPER DETECTION: silent swap of calibrated_p breaks Ed25519 verify", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const split = computeCalibrationRankingSplit(OBVIOUS_APPROVE_VOICES, WEIGHTS);
  const originalHash = calibrationRankingSplitCommitment(split, OBVIOUS_APPROVE_VOICES, WEIGHTS);
  // Simulate silent tampering: lower calibrated_p from ~0.9 to 0.5 to skirt Brier
  const tamperedHash = calibrationRankingSplitCommitment(
    { calibrated_p: 0.5, ranking_score: split.ranking_score },
    OBVIOUS_APPROVE_VOICES, WEIGHTS,
  );
  assert.notEqual(originalHash, tamperedHash);

  const request = { loan: { fico: 720 } };
  const response = { verdict: "approve" };
  const att = buildAttestation({
    request, response,
    modelId: "claude-sonnet-4-6",
    mode: SIGNATURE_MODES.ED25519,
    privateKey,
    calibrationRankingSplitSha256: originalHash,
  });
  att.calibration_ranking_split_sha256 = tamperedHash;
  const v = verifyAttestation(att, request, response, { publicKey });
  assert.equal(v.ok, false);
});


test("BACK-COMPAT: attestation without calibration_ranking_split_sha256 verifies unchanged", () => {
  const request = { loan: { fico: 720 } };
  const response = { verdict: "approve" };
  const att = buildAttestation({
    request, response,
    modelId: "claude-sonnet-4-6",
    secret: "test-secret",
  });
  assert.equal(att.calibration_ranking_split_sha256, undefined);
  const v = verifyAttestation(att, request, response, "test-secret");
  assert.equal(v.ok, true);
});


test("BINDING: attestation signs over calibration_ranking_split_sha256 (Ed25519)", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const split = computeCalibrationRankingSplit(BORDERLINE_VOICES, WEIGHTS);
  const hash = calibrationRankingSplitCommitment(split, BORDERLINE_VOICES, WEIGHTS);
  const request = { loan: { fico: 705 } };
  const response = { verdict: "escalate" };
  const att = buildAttestation({
    request, response,
    modelId: "claude-sonnet-4-6",
    mode: SIGNATURE_MODES.ED25519,
    privateKey,
    calibrationRankingSplitSha256: hash,
  });
  const v = verifyAttestation(att, request, response, { publicKey });
  assert.equal(v.ok, true);
});
