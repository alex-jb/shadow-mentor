// The integration test: build a full Shadow Lens session that seals a REAL attest-core
// bundle, produces a contract-valid session, verifies, and fails on tamper at the exact seq.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { buildShadowLensSession } from "../apps/shadow-lens/backend/build-session.mjs";
import { computeSourceMapHash } from "../apps/shadow-lens/backend/analyze.mjs";
import { verifyBundle } from "../packages/attest-core/session.js";

function keys() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { priv: privateKey.export({ type: "pkcs8", format: "pem" }), pub: publicKey.export({ type: "spki", format: "pem" }) };
}
const SM = [
  { source_id: "L1", text: "FICO Score: 706", normalized_value: 706, bounding_box_normalized: { x: 0.1, y: 0.3, w: 0.4, h: 0.03 }, confidence: 0.97 },
  { source_id: "L2", text: "DTI: 0.41", normalized_value: 0.41, bounding_box_normalized: { x: 0.1, y: 0.34, w: 0.4, h: 0.03 }, confidence: 0.95 },
];
function input(k) {
  return {
    session_id: "sls-int-1",
    device: { platform: "unity-xreal", runtime_mode: "UNITY_XREAL", tracking_mode: "6dof", camera_mode: "xreal-eye", glasses_model: "XREAL One Pro", eye_attached: true },
    build: { app_commit: "test" },
    capture: { capture_id: "cap1", capture_sha256: "sha256:" + "a".repeat(64), capture_method: "xreal-eye-still" },
    sourceMap: SM,
    analysisResult: {
      findings: [
        { claim: "DTI 0.41 over ceiling", source_ids: ["L2"], confidence: 0.9, severity: "warn", validation_status: "source_bound" },
        { claim: "FICO clears floor", source_ids: ["L1"], confidence: 0.92, severity: "ok", validation_status: "source_bound" },
      ],
      source_bound_count: 2, rejected_count: 0, source_map_hash: computeSourceMapHash(SM),
      model_id: "claude-haiku-4-5", prompt_hash: "sha256:" + "b".repeat(64), source_coverage_pct: 100,
    },
    reviewers: [{ voice: "Risk Officer", stance: "caution", confidence: 0.8 }],
    reviewer_interaction: { decision: "approved", reviewer_id: "u-9", review_duration_ms: 30000 },
    signingKeyPem: k.priv, publicKeyPem: k.pub,
  };
}

test("builds a contract-valid session backed by a real, verifying bundle", () => {
  const k = keys();
  const { session, bundle, verified, valid, validation_errors } = buildShadowLensSession(input(k));
  assert.equal(valid, true, validation_errors.join("; "));
  assert.equal(verified.ok, true);
  assert.equal(session.verification.record_integrity, "verified");
  assert.equal(session.claims.length, 2);           // both source_bound findings become claims
  assert.equal(session.provenance.source_map_hash, computeSourceMapHash(SM));
  assert.ok(bundle.signatures.length === 1 && bundle.batch_root);
  assert.equal(session.verification.human_review, "approved");
});

test("tamper the sealed bundle → the SAME verifier fails at the exact seq", () => {
  const k = keys();
  const { bundle } = buildShadowLensSession(input(k));
  // alter a payload_hash (as if a source value were rewritten after signing)
  const tampered = JSON.parse(JSON.stringify(bundle));
  tampered.events[2].payload_hash = tampered.events[2].payload_hash.replace(/^./, (c) => (c === "0" ? "1" : "0"));
  tampered.events[2].payload_ref = `sha256:${tampered.events[2].payload_hash}`;
  const r = verifyBundle(tampered, { publicKey: k.pub });
  assert.equal(r.ok, false);
  assert.equal(typeof r.failedSeq, "number");
});
