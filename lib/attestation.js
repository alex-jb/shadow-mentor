// lib/attestation.js
// ──────────────────────────────────────────────────────────────────
// AEX-style multi-hop attestation for /api/deliberate + /api/loan-council.
//
// Ships 2026-07-02 based on AEX (arXiv:2603.14283, June 2026) which
// specifies a signed top-level attestation object binding request-
// commitment ↔ output-commitment. Also covers the failure mode from
// "Auditing Model Substitution in LLM APIs" (arXiv:2504.04715) —
// API providers can silently swap models; only cryptographic
// attestation catches it.
//
// Defense layers
// --------------
// Shadow already ships:
//   - Hash-chain audit log (SHA-256 chain across decisions)
//   - Prompt SHA-256 pin per response
//   - Model ID field per response
//
// What this module adds:
//   - SHA-256 commitment of the FULL request payload (loan + policy)
//   - SHA-256 commitment of the FULL response body (verdict + voices)
//   - Signature over both commitments + model_id + completed_at_utc
//
// Signature modes
// ---------------
// Two modes supported. The mode is stamped into the attestation
// object so a downstream auditor knows how to verify.
//
// **hmac (default, back-compat)** — HMAC-SHA-256 with a symmetric
// server_secret. Anyone with the secret can BOTH sign and verify.
// Simple but requires the bank auditor to hold Shadow's server
// secret (which also means they could forge — not cleanly
// separable). Use for dev + internal audits.
//
// **ed25519 (recommended for procurement)** — asymmetric public-
// key signature. Shadow holds the private key, bank auditor holds
// only the public key. Bank can VERIFY but cannot FORGE. This is
// the posture procurement teams want because "who can sign" and
// "who can verify" are cleanly separated.
//
// Ed25519 was chosen because: (1) 256-bit private key = same
// footprint as HMAC secret, (2) 64-byte signature, (3) fast
// (~50µs sign / ~200µs verify on M1), (4) shipped in Node's stdlib
// crypto module since v12, no dep needed. RFC 8032.
//
// Verification
// ------------
// Auditor recomputes both commitments from persisted request +
// response bodies, recomputes the signature using either the
// shared secret (hmac) or the public key (ed25519), compares
// against the stored signature. Any mismatch = record was tampered
// OR a silent model swap happened OR key material rotated without
// re-signing.
//
// Key rotation
// ------------
// The signature carries a `keyId` so multiple keys can co-exist
// (grace period for rotation). Auditor picks the right key by
// keyId. Rotate at least yearly per NIST SP 800-57 §5.2.
//
// Ref
// ---
// - arXiv:2603.14283 AEX: Non-Intrusive Multi-Hop Attestation for LLM APIs
// - arXiv:2504.04715 Auditing Model Substitution in LLM APIs
// - RFC 8032 Edwards-Curve Digital Signature Algorithm (EdDSA)
// - NIST SP 800-57 Part 1 §5.2 key rotation cadence

import {
  createHash, createHmac,
  createPrivateKey, createPublicKey,
  sign as cryptoSign, verify as cryptoVerify,
} from "node:crypto";


// Deploy-time secret. In production this comes from an env var or
// KMS. For dev the default is fine because the signature is only
// verifiable by whoever holds the secret — a dev signature won't
// match a prod verifier.
const DEFAULT_SECRET =
  process.env.SHADOW_ATTESTATION_SECRET
  || "dev-shadow-attestation-secret-DO-NOT-USE-IN-PROD";

const DEFAULT_KEY_ID = process.env.SHADOW_ATTESTATION_KEY_ID || "dev-v1";

const ATTESTATION_VERSION = "aex-attestation/v1";

// Signature modes shipped in v1. The mode is stamped into the
// attestation object so a downstream auditor knows which verifier
// path to use. See module docstring for tradeoffs.
export const SIGNATURE_MODES = Object.freeze({
  HMAC: "hmac-sha256",
  ED25519: "ed25519",
});

// Default mode. HMAC keeps existing callers back-compat. Ops teams
// running procurement pilots should flip to ed25519 via env var:
//   SHADOW_ATTESTATION_MODE=ed25519
//   SHADOW_ATTESTATION_ED25519_PRIVATE_KEY=<PEM or base64 raw>
//   SHADOW_ATTESTATION_KEY_ID=<rotation-tag>
const DEFAULT_MODE = process.env.SHADOW_ATTESTATION_MODE === "ed25519"
  ? SIGNATURE_MODES.ED25519
  : SIGNATURE_MODES.HMAC;

// Ed25519 key material from env — nullable; we only fail if callers
// actually request ed25519 mode without providing a key.
const DEFAULT_ED25519_PRIVATE_PEM =
  process.env.SHADOW_ATTESTATION_ED25519_PRIVATE_KEY || null;
const DEFAULT_ED25519_PUBLIC_PEM =
  process.env.SHADOW_ATTESTATION_ED25519_PUBLIC_KEY || null;


/**
 * Compute SHA-256 hex digest of a value. Objects are canonicalized
 * via JSON.stringify with sorted keys so signatures are stable
 * regardless of key ordering.
 */
export function commitmentOf(value) {
  const canonical = canonicalize(value);
  return createHash("sha256").update(canonical).digest("hex");
}


/**
 * Canonicalize a value for deterministic hashing. Objects → sorted-
 * key JSON. Arrays → element-wise canonicalization. Primitives → as-is.
 *
 * This matters because JSON.stringify({a:1,b:2}) !== JSON.stringify({b:2,a:1})
 * — two functionally-equivalent responses would otherwise produce
 * two different commitments.
 */
export function canonicalize(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) =>
    JSON.stringify(k) + ":" + canonicalize(value[k]),
  ).join(",") + "}";
}


/**
 * Compose the canonical signing payload string. Both hmac and
 * ed25519 modes sign THE SAME BYTES, so an attestation object can
 * (in principle) be dual-signed for a rotation window. The mode
 * string is included so a hmac-signed payload can't be reused as
 * ed25519 material (domain separation).
 *
 * `dictionaryHash` is optional (v1.5.8+). When absent, the field is
 * omitted from the payload so old (pre-v1.5.8) attestations continue
 * to verify byte-for-byte. When present, the hash of the signed
 * reason-code dictionary at decision time is bound into the signature
 * so any post-hoc dictionary tampering breaks verification.
 */
function _signingPayload({ mode, requestCommitment, outputCommitment,
                          modelId, completedAtUtc, previousHash, keyId,
                          dictionaryHash, citationRegistrySha256,
                          proxySchemaSha256, originalContentHash,
                          policyInvarianceScoreSha256,
                          adverseActionNoticeSha256,
                          samplingSeedCommitmentSha256,
                          evidencePartitionSchemeSha256,
                          heterogeneityCommitmentSha256,
                          claimTypeSha256,
                          bianCoverageSha256,
                          eticasTaxonomySha256 }) {
  const parts = [
    ATTESTATION_VERSION,
    mode,
    requestCommitment,
    outputCommitment,
    modelId,
    completedAtUtc,
    previousHash || "",
    keyId,
  ];
  // Only append when the caller signed with a dictionary hash. This
  // keeps every pre-v1.5.8 attestation verifying unchanged: they were
  // signed without this field, and verification recomputes the payload
  // without it because the attestation object doesn't carry it.
  if (dictionaryHash) parts.push(dictionaryHash);
  // v1.5.18: same back-compat append-only pattern as dictionaryHash.
  if (citationRegistrySha256) parts.push(citationRegistrySha256);
  // v1.5.19: same conditional append pattern. Bank counsel pins
  // proxy_schema_sha256 in procurement contract so post-hoc edits
  // to the ECOA §701 blocklist (e.g. quietly softening from hard-block
  // to advisory on a class the bank finds inconvenient) break Ed25519
  // verification.
  if (proxySchemaSha256) parts.push(proxySchemaSha256);
  // v1.5.20: Pattern C original_content_hash. Same conditional
  // append-only pattern. When Shadow ships CCR (compressed content
  // retrieval) mode later, MCP tool responses will carry
  // {summary_120w, ccr_hash, retrieve_via} where output_commitment
  // covers only the summary. original_content_hash then covers the
  // PRE-COMPRESSION original so bank counsel can verify the summary
  // was derived from what the bank actually saw. Pre-v1.5.20
  // attestations sign without this field and verify unchanged; the
  // scaffold ships now so v1.5.20+ callers who opt-in are ready.
  if (originalContentHash) parts.push(originalContentHash);
  // v1.5.23: append-only pattern continues. When the caller provides
  // a Judge Card SHA-256 (per arXiv:2605.06161 Policy Invariance
  // Score protocol), it binds into the signing payload. Bank counsel
  // pins the Judge Card hash in procurement contracts so any post-
  // hoc metric relaxation (e.g. quietly widening the ambiguity
  // signal list to raise scores) breaks Ed25519 verification.
  if (policyInvarianceScoreSha256) parts.push(policyInvarianceScoreSha256);
  // v1.5.24: append-only pattern continues. When the caller binds a
  // GAICF-compatible adverse-action notice hash (per Wang et al
  // arXiv:2607.04103 layer 3), it flows into the signing payload
  // so any post-hoc softening of the notice text breaks Ed25519
  // verification. Bank counsel pins the notice hash in the
  // procurement contract alongside the verdict hash.
  if (adverseActionNoticeSha256) parts.push(adverseActionNoticeSha256);
  // v1.5.28 (arXiv:2606.16121): append the sampling-seed commitment
  // when the caller binds it. Same append-only pattern. Detects
  // silent seed / temperature substitution between council calls.
  if (samplingSeedCommitmentSha256) parts.push(samplingSeedCommitmentSha256);
  // v1.5.30 (arXiv:2607.01661): append the evidence-partition scheme
  // hash. Same append-only pattern. Detects silent partition-scheme
  // swap between decisions (e.g. quietly widening compliance's field
  // list to include credit_score would break correlated-vote
  // defense; the hash change makes it detectable).
  if (evidencePartitionSchemeSha256) parts.push(evidencePartitionSchemeSha256);
  // v1.5.32 (arXiv:2606.19826): append the heterogeneous-debate
  // enforcement commitment. Same append-only pattern. Detects silent
  // post-hoc relaxation of the min-providers requirement (e.g. quietly
  // lowering min_providers from 2 to 1 to permit a single-provider
  // deployment, which would fail the adversarial-peer defense).
  if (heterogeneityCommitmentSha256) parts.push(heterogeneityCommitmentSha256);
  // v1.5.37 (arXiv:2605.20312 Pramana): append the typed-claim
  // envelope hash. Same append-only pattern. Detects silent post-hoc
  // reclassification of a claim (e.g. downgrading an inference-class
  // claim to perception-class to skip seed-commitment verification
  // at audit time).
  if (claimTypeSha256) parts.push(claimTypeSha256);
  // v1.5.39 (arXiv:2607.01740 BIAN meta-benchmark): append the
  // persona→BIAN coverage map hash. Same append-only pattern. Detects
  // silent widening of a persona's claimed BIAN domain (e.g. quietly
  // asserting Compliance Officer covers "Fraud Detection" when it
  // does not) which would let a bank claim BIAN coverage it cannot
  // actually deliver.
  if (bianCoverageSha256) parts.push(bianCoverageSha256);
  // v1.5.40 (arXiv:2607.02201 Eticas AI Risk Taxonomy v2.0.0):
  // append the Eticas subcategory map hash. Same append-only pattern.
  // Detects silent widening of a Shadow test's claimed Eticas
  // subcategory coverage (e.g. claiming "adversarial-peer-defense"
  // without shipping the underlying heterogeneous-debate test).
  if (eticasTaxonomySha256) parts.push(eticasTaxonomySha256);
  return parts.join("|");
}


/**
 * Build a signed attestation object for a Shadow decision.
 *
 * @param {object} params
 * @param {object} params.request — the exact input the caller sent
 *   (loan dict + policy + any other config)
 * @param {object} params.response — the exact response body Shadow
 *   is about to return (verdict + voices + risk_packet + etc.).
 *   IMPORTANT: pass this BEFORE embedding the attestation object
 *   itself — else you're hashing the attestation into itself.
 * @param {string} params.modelId — e.g. "claude-sonnet-4-6"
 * @param {string} [params.completedAtUtc] — ISO 8601. Defaults to now.
 * @param {string} [params.previousHash] — SHA-256 of previous
 *   response's attestation. Enables hash-chain. Optional (first
 *   response has no previous).
 * @param {string} [params.mode] — SIGNATURE_MODES.HMAC (default,
 *   back-compat) or SIGNATURE_MODES.ED25519 (recommended for
 *   procurement — asymmetric).
 * @param {string} [params.secret] — HMAC mode only. Override for tests.
 * @param {string|KeyObject} [params.privateKey] — Ed25519 mode only.
 *   PEM string OR a Node KeyObject. Falls back to
 *   SHADOW_ATTESTATION_ED25519_PRIVATE_KEY env var.
 * @param {string} [params.keyId] — override for tests
 * @returns {{
 *   version: string,
 *   mode: string,                 // "hmac-sha256" | "ed25519"
 *   request_commitment: string,   // sha256 hex
 *   output_commitment: string,    // sha256 hex
 *   model_id: string,
 *   completed_at_utc: string,
 *   previous_hash: string|null,
 *   key_id: string,
 *   signature: string,            // hex (hmac) or base64 (ed25519)
 * }}
 */
export function buildAttestation(params) {
  const {
    request,
    response,
    modelId,
    completedAtUtc = new Date().toISOString(),
    previousHash = null,
    mode = DEFAULT_MODE,
    secret = DEFAULT_SECRET,
    privateKey = DEFAULT_ED25519_PRIVATE_PEM,
    keyId = DEFAULT_KEY_ID,
    dictionaryHash = null,  // v1.5.8+: hash of the signed reason-code dictionary at decision time
    citationRegistrySha256 = null,  // v1.5.18+: hash of the CFR citation registry at decision time
    proxySchemaSha256 = null,  // v1.5.19+: hash of the ECOA §701 protected-classes schema at decision time
    originalContentHash = null,  // v1.5.20+: SHA-256 of pre-compression original when CCR mode is active
    policyInvarianceScoreSha256 = null,  // v1.5.23+: SHA-256 of the Judge Card artifact (arXiv:2605.06161)
    adverseActionNoticeSha256 = null,  // v1.5.24+: SHA-256 of the bilingual §1002.9(b)(2) adverse-action notice (arXiv:2607.04103 layer 3)
    samplingSeedCommitmentSha256 = null,  // v1.5.28+: SHA-256 of the sampling-seed commitment (arXiv:2606.16121 invisible-manipulation defense)
    evidencePartitionSchemeSha256 = null,  // v1.5.30+: SHA-256 of the InfoDelphi evidence-partition scheme (arXiv:2607.01661)
    heterogeneityCommitmentSha256 = null,  // v1.5.32+: SHA-256 of the heterogeneous-debate enforcement commitment (arXiv:2606.19826)
    claimTypeSha256 = null,  // v1.5.37+: SHA-256 of the typed-claim envelope (arXiv:2605.20312 Pramana)
    bianCoverageSha256 = null,  // v1.5.39+: SHA-256 of the persona→BIAN coverage map (arXiv:2607.01740)
    eticasTaxonomySha256 = null,  // v1.5.40+: SHA-256 of the Eticas AI Risk Taxonomy v2 map (arXiv:2607.02201)
  } = params;

  if (!request) throw new Error("buildAttestation: request required");
  if (!response) throw new Error("buildAttestation: response required");
  if (!modelId) throw new Error("buildAttestation: modelId required");
  if (mode !== SIGNATURE_MODES.HMAC && mode !== SIGNATURE_MODES.ED25519) {
    throw new Error(`buildAttestation: unsupported mode "${mode}"`);
  }

  const requestCommitment = commitmentOf(request);
  const outputCommitment = commitmentOf(response);

  const signingPayload = _signingPayload({
    mode, requestCommitment, outputCommitment,
    modelId, completedAtUtc, previousHash, keyId, dictionaryHash,
    citationRegistrySha256, proxySchemaSha256, originalContentHash,
    policyInvarianceScoreSha256, adverseActionNoticeSha256,
    samplingSeedCommitmentSha256, evidencePartitionSchemeSha256,
    heterogeneityCommitmentSha256, claimTypeSha256, bianCoverageSha256,
    eticasTaxonomySha256,
  });

  let signature;
  if (mode === SIGNATURE_MODES.HMAC) {
    signature = createHmac("sha256", secret)
      .update(signingPayload)
      .digest("hex");
  } else {
    // Ed25519
    if (!privateKey) {
      throw new Error(
        "buildAttestation: ed25519 mode requires privateKey (or " +
        "SHADOW_ATTESTATION_ED25519_PRIVATE_KEY env var)",
      );
    }
    const keyObj = _asPrivateKey(privateKey);
    // Node's crypto.sign with algorithm=null does Ed25519 (which
    // is a pure-EdDSA scheme, not a hash-and-sign).
    signature = cryptoSign(null, Buffer.from(signingPayload), keyObj)
      .toString("base64");
  }

  return {
    version: ATTESTATION_VERSION,
    mode,
    request_commitment: requestCommitment,
    output_commitment: outputCommitment,
    model_id: modelId,
    completed_at_utc: completedAtUtc,
    previous_hash: previousHash,
    key_id: keyId,
    // v1.5.8+: only present when the caller bound a dictionary hash.
    // Old attestations omit this field entirely, keeping wire back-compat.
    ...(dictionaryHash ? { dictionary_hash: dictionaryHash } : {}),
    // v1.5.18+: same back-compat append-only pattern. Bank counsel
    // pins citation_registry_sha256 in the procurement contract; any
    // post-hoc registry edit breaks verification.
    ...(citationRegistrySha256 ? { citation_registry_sha256: citationRegistrySha256 } : {}),
    // v1.5.19+: same append-only pattern for the ECOA §701 protected-
    // classes schema hash. Post-hoc softening of the blocklist breaks
    // verification.
    ...(proxySchemaSha256 ? { proxy_schema_sha256: proxySchemaSha256 } : {}),
    // v1.5.20+: Pattern C original_content_hash scaffold. Populated
    // only when Shadow ships CCR compression mode (deferred). Present
    // as append-only field so v1.5.20+ callers who opt in are already
    // wire-compatible with future v1.5.21+ CCR implementations.
    ...(originalContentHash ? { original_content_hash: originalContentHash } : {}),
    // v1.5.23+: Judge Card SHA-256 per Weng et al arXiv:2605.06161.
    // Same append-only pattern. Bank counsel pins the value in
    // procurement contracts so a downstream metric-relaxation
    // (widening the ambiguity signal list, softening thresholds)
    // breaks Ed25519 verification.
    ...(policyInvarianceScoreSha256 ? { policy_invariance_score_sha256: policyInvarianceScoreSha256 } : {}),
    // v1.5.24+: adverse-action notice hash per Wang et al 2607.04103
    // layer 3. Same append-only pattern. Bank counsel pins the notice
    // hash in the procurement contract so post-hoc notice edits break
    // Ed25519 verification.
    ...(adverseActionNoticeSha256 ? { adverse_action_notice_sha256: adverseActionNoticeSha256 } : {}),
    // v1.5.28+: sampling-seed commitment per arXiv:2606.16121.
    // Same append-only pattern. Post-hoc edit of the seed / model /
    // temperature that Shadow requested breaks Ed25519 verification.
    ...(samplingSeedCommitmentSha256 ? { sampling_seed_commitment_sha256: samplingSeedCommitmentSha256 } : {}),
    // v1.5.30+: evidence-partition scheme hash per arXiv:2607.01661.
    ...(evidencePartitionSchemeSha256 ? { evidence_partition_scheme_sha256: evidencePartitionSchemeSha256 } : {}),
    // v1.5.32+: heterogeneity commitment per arXiv:2606.19826. Same
    // append-only pattern. Post-hoc lowering of min_providers (silently
    // permitting a single-provider deployment that fails the
    // adversarial-peer defense) breaks Ed25519 verification.
    ...(heterogeneityCommitmentSha256 ? { heterogeneity_commitment_sha256: heterogeneityCommitmentSha256 } : {}),
    // v1.5.37+: typed-claim envelope hash per arXiv:2605.20312 Pramana.
    // Same append-only pattern. Post-hoc silent reclassification of
    // the claim (e.g. downgrading INFERENCE to PERCEPTION to skip
    // seed-commitment verification) breaks Ed25519 verification.
    ...(claimTypeSha256 ? { claim_type_sha256: claimTypeSha256 } : {}),
    // v1.5.39+: BIAN coverage map hash per arXiv:2607.01740. Same
    // append-only pattern. Silent widening of a persona's claimed
    // BIAN domain breaks Ed25519 verification.
    ...(bianCoverageSha256 ? { bian_coverage_sha256: bianCoverageSha256 } : {}),
    // v1.5.40+: Eticas Taxonomy map hash per arXiv:2607.02201. Same
    // append-only pattern. Silent widening of a Shadow test's
    // claimed Eticas subcategory coverage breaks Ed25519 verification.
    ...(eticasTaxonomySha256 ? { eticas_taxonomy_sha256: eticasTaxonomySha256 } : {}),
    signature,
  };
}


function _asPrivateKey(input) {
  if (typeof input === "object" && input.asymmetricKeyType) return input;
  // PEM string or raw base64 → coerce to KeyObject.
  const str = String(input);
  if (str.includes("BEGIN")) {
    return createPrivateKey({ key: str, format: "pem" });
  }
  // Assume raw 32-byte seed base64-encoded; wrap into DER PKCS8
  // (Node requires that form when constructing an Ed25519 key from
  // a raw seed). This helper preserves callers that pass a raw seed.
  const raw = Buffer.from(str, "base64");
  if (raw.length !== 32) {
    throw new Error(
      `_asPrivateKey: raw Ed25519 seed must be 32 bytes, got ${raw.length}`,
    );
  }
  // PKCS8 wrapper for Ed25519: SEQUENCE { 0, AlgorithmId, OCTET STRING }
  const pkcs8 = Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    raw,
  ]);
  return createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
}


function _asPublicKey(input) {
  if (typeof input === "object" && input.asymmetricKeyType) return input;
  const str = String(input);
  if (str.includes("BEGIN")) {
    return createPublicKey({ key: str, format: "pem" });
  }
  // Raw 32-byte public key base64 → SPKI DER wrapper
  const raw = Buffer.from(str, "base64");
  if (raw.length !== 32) {
    throw new Error(
      `_asPublicKey: raw Ed25519 public key must be 32 bytes, got ${raw.length}`,
    );
  }
  const spki = Buffer.concat([
    Buffer.from("302a300506032b6570032100", "hex"),
    raw,
  ]);
  return createPublicKey({ key: spki, format: "der", type: "spki" });
}


/**
 * Verify a signed attestation against a persisted request + response.
 * Returns a diagnostic object; ok=false means the record is tampered
 * OR a silent model swap happened OR the wrong key material was used.
 *
 * @param {object} attestation — the signed object built earlier
 * @param {object} originalRequest — persisted request payload
 * @param {object} originalResponse — persisted response body (with
 *   attestation field removed — pass response.body minus attestation)
 * @param {object} [keys] — key material for verification
 * @param {string} [keys.secret] — HMAC secret (for hmac-sha256 mode)
 * @param {string|KeyObject} [keys.publicKey] — Ed25519 public key
 *   (PEM string, base64 raw 32-byte, or Node KeyObject). Falls back
 *   to SHADOW_ATTESTATION_ED25519_PUBLIC_KEY env var.
 * @returns {{ok: boolean, reason: string, checks: object}}
 *
 * Legacy positional call verifyAttestation(attestation, req, res, secretString)
 * still works — a bare string 4th arg is treated as `secret`.
 */
export function verifyAttestation(attestation, originalRequest,
                                    originalResponse, keys = {}) {
  const checks = {};

  if (!attestation || typeof attestation !== "object") {
    return { ok: false, reason: "attestation missing or malformed", checks };
  }
  if (attestation.version !== ATTESTATION_VERSION) {
    return {
      ok: false,
      reason: `unsupported attestation version: ${attestation.version}`,
      checks,
    };
  }

  // Legacy positional signature: bare string means hmac secret.
  const legacySecret = typeof keys === "string" ? keys : null;
  const secret = legacySecret ?? keys.secret ?? DEFAULT_SECRET;
  const publicKey = keys.publicKey ?? DEFAULT_ED25519_PUBLIC_PEM;

  // Verify request commitment
  const expectedRequest = commitmentOf(originalRequest);
  checks.request_commitment_match =
    expectedRequest === attestation.request_commitment;
  if (!checks.request_commitment_match) {
    return {
      ok: false,
      reason: "request commitment mismatch — record was tampered",
      checks,
    };
  }

  // Verify output commitment
  const expectedOutput = commitmentOf(originalResponse);
  checks.output_commitment_match =
    expectedOutput === attestation.output_commitment;
  if (!checks.output_commitment_match) {
    return {
      ok: false,
      reason: "output commitment mismatch — response was tampered",
      checks,
    };
  }

  // Dispatch signature verification by mode.
  // Missing mode field → treat as hmac (v0 back-compat with older
  // attestations built before the mode field existed).
  const mode = attestation.mode ?? SIGNATURE_MODES.HMAC;
  const signingPayload = _signingPayload({
    mode,
    requestCommitment: attestation.request_commitment,
    outputCommitment: attestation.output_commitment,
    modelId: attestation.model_id,
    completedAtUtc: attestation.completed_at_utc,
    previousHash: attestation.previous_hash,
    keyId: attestation.key_id,
    // v1.5.8+: dictionary_hash is included in the signing payload only
    // when the attestation object itself carries it. This preserves
    // wire back-compat: pre-v1.5.8 attestations verify unchanged.
    dictionaryHash: attestation.dictionary_hash,
    // v1.5.18+: same conditional pattern for citation_registry_sha256.
    citationRegistrySha256: attestation.citation_registry_sha256,
    // v1.5.19+: same conditional pattern for proxy_schema_sha256.
    proxySchemaSha256: attestation.proxy_schema_sha256,
    // v1.5.20+: same conditional pattern for original_content_hash.
    originalContentHash: attestation.original_content_hash,
    // v1.5.23+: same conditional pattern for policy_invariance_score_sha256.
    policyInvarianceScoreSha256: attestation.policy_invariance_score_sha256,
    // v1.5.24+: same conditional pattern for adverse_action_notice_sha256.
    adverseActionNoticeSha256: attestation.adverse_action_notice_sha256,
    // v1.5.28+: same conditional pattern for sampling_seed_commitment_sha256.
    samplingSeedCommitmentSha256: attestation.sampling_seed_commitment_sha256,
    // v1.5.30+: same conditional pattern for evidence_partition_scheme_sha256.
    evidencePartitionSchemeSha256: attestation.evidence_partition_scheme_sha256,
    // v1.5.32+: same conditional pattern for heterogeneity_commitment_sha256.
    heterogeneityCommitmentSha256: attestation.heterogeneity_commitment_sha256,
    // v1.5.37+: same conditional pattern for claim_type_sha256.
    claimTypeSha256: attestation.claim_type_sha256,
    // v1.5.39+: same conditional pattern for bian_coverage_sha256.
    bianCoverageSha256: attestation.bian_coverage_sha256,
    // v1.5.40+: same conditional pattern for eticas_taxonomy_sha256.
    eticasTaxonomySha256: attestation.eticas_taxonomy_sha256,
  });

  if (mode === SIGNATURE_MODES.HMAC) {
    const expectedSignature = createHmac("sha256", secret)
      .update(signingPayload)
      .digest("hex");
    checks.signature_match = expectedSignature === attestation.signature;
    if (!checks.signature_match) {
      return {
        ok: false,
        reason:
          "signature mismatch — either the wrong server_secret was used, " +
          "or the model_id / completed_at_utc were tampered with silently.",
        checks,
      };
    }
  } else if (mode === SIGNATURE_MODES.ED25519) {
    if (!publicKey) {
      return {
        ok: false,
        reason:
          "ed25519 verification requires publicKey (or " +
          "SHADOW_ATTESTATION_ED25519_PUBLIC_KEY env var)",
        checks,
      };
    }
    const keyObj = _asPublicKey(publicKey);
    const sigBuf = Buffer.from(attestation.signature, "base64");
    checks.signature_match = cryptoVerify(
      null, Buffer.from(signingPayload), keyObj, sigBuf,
    );
    if (!checks.signature_match) {
      return {
        ok: false,
        reason:
          "ed25519 signature mismatch — either the wrong public key was used, " +
          "or the attestation was signed by a different private key, or the " +
          "model_id / completed_at_utc were tampered with silently.",
        checks,
      };
    }
  } else {
    return {
      ok: false,
      reason: `unsupported attestation signature mode "${mode}"`,
      checks,
    };
  }

  return {
    ok: true,
    reason: "attestation verified",
    checks,
  };
}


export { ATTESTATION_VERSION };
