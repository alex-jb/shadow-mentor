// apps/shadow-lens/backend/build-session.mjs
// The integration keystone (Section 11): assemble a full ShadowLensSession AND seal a REAL
// attest-core evidence bundle for it, server-side, then verify. Turns the separate modules
// (capture → OCR source_map → source-bound analysis) into one signed, verifiable session —
// the real thing every renderer consumes. Signing is server-side only (the caller supplies
// the private key; clients never hold it). Reuses attest-core (no reimplementation).
import { createSession, appendEvent, sealSession, verifyBundle } from "../../../packages/attest-core/session.js";
import { CONTRACT_VERSION, validateShadowLensSession } from "../contracts/validate.mjs";

/**
 * @param {object} input
 *  - session_id, device, build, capture (contract shapes)
 *  - sourceMap: OCR source_map
 *  - analysisResult: output of analyzeSourceBound (findings + hashes + coverage)
 *  - reviewers?, decision?
 *  - reviewer_interaction?: {decision, override_rationale?, ...} for the human_approval event
 *  - signingKeyPem (PKCS8), publicKeyPem (SPKI), keyId?
 * @returns {{ session, bundle, verified, valid, validation_errors }}
 */
export function buildShadowLensSession(input) {
  const {
    session_id, device, build, capture, sourceMap, analysisResult,
    reviewers = null, decision = null, reviewer_interaction = null,
    signingKeyPem, publicKeyPem, keyId = "shadow-lens-demo",
  } = input;

  // 1 — seal a REAL attest-core bundle for the pipeline (server-side).
  const s = createSession({
    agent: { name: "shadow-lens", version: String(build?.app_commit ?? "0") },
    models: [{ model_id: analysisResult?.model_id ?? "unknown", provider: "anthropic" }],
    environmentFingerprint: { os: device?.platform ?? "unknown", node_version: "n/a" },
    keyId, privateKey: signingKeyPem,
  });
  appendEvent(s, { event_type: "prompt", actor: "user", payload: { command: "scan_document" } });
  appendEvent(s, { event_type: "tool_call", actor: "tool", payload: { tool: "xreal-eye-capture" } });
  appendEvent(s, { event_type: "tool_result", actor: "tool", payload: { capture_sha256: capture?.capture_sha256 } });
  appendEvent(s, { event_type: "tool_result", actor: "tool",
    payload: { ocr_engine: "mlkit-text-recognition", source_map_hash: analysisResult?.source_map_hash },
    extensions: { source_map_hash: analysisResult?.source_map_hash } });
  appendEvent(s, { event_type: "model_output", actor: "model",
    payload: { findings_count: analysisResult?.source_bound_count ?? 0, model_id: analysisResult?.model_id, prompt_hash: analysisResult?.prompt_hash } });
  if (reviewers && reviewers.length) {
    appendEvent(s, { event_type: "human_approval", actor: "user",
      payload: { approved: true, ...(reviewer_interaction ? { reviewer_interaction } : {}) } });
  }
  const bundle = sealSession(s);
  const verified = verifyBundle(bundle, { publicKey: publicKeyPem });

  // 2 — assemble the ShadowLensSession from the real pieces.
  const claims = (analysisResult?.findings ?? [])
    .filter((f) => f.validation_status === "source_bound")
    .map((f, i) => ({ claim_id: `c${i + 1}`, text: f.claim, source_ids: f.source_ids || [], produced_by: "model", validation_status: "source_bound", confidence: f.confidence ?? null, severity: f.severity ?? null }));

  const session = {
    contract_version: CONTRACT_VERSION,
    session_id,
    build,
    device,
    capture,
    source_map: sourceMap,
    claims,
    reviewers,
    decision,
    provenance: {
      capture_hash: capture?.capture_sha256,
      source_map_hash: analysisResult?.source_map_hash,
      ocr_engine: "mlkit-text-recognition",
      ocr_version: "bundled",
      model_id: analysisResult?.model_id ?? null,
      prompt_hash: analysisResult?.prompt_hash ?? null,
      app_commit: build?.app_commit ?? null,
    },
    verification: {
      record_integrity: verified.ok ? "verified" : "failed",
      failed_seq: verified.ok ? null : (verified.failedSeq ?? null),
      failure_reason: verified.ok ? null : (verified.reason ?? verified.error?.reason ?? "broken"),
      external_anchor: "none",
      source_coverage_pct: analysisResult?.source_coverage_pct ?? null,
      analysis_confidence: null,
      human_review: reviewers && reviewers.length ? "approved" : "pending",
      data_freshness_sec: null,
    },
  };

  const v = validateShadowLensSession(session);
  return { session, bundle, verified, valid: v.valid, validation_errors: v.errors };
}
