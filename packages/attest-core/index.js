// packages/attest-core/index.js
// ─────────────────────────────────────────────────────────────────
// shadow-attest-core — public API contract surface.
//
// v2.0.0 (2026-07-10): source files now physically live in this
// directory. lib/attestation.js and lib/attestation-chain.js are
// back-compat shims that re-export from here.
//
// A dedicated CI test (test/attest-core-contract.test.js) verifies:
//   1. Every symbol re-exported below actually resolves.
//   2. None of the source files reachable from this entry point
//      import any LLM SDK (anthropic, openai, google-genai, etc).
//
// ─────────────────────────────────────────────────────────────────

export {
  ATTESTATION_VERSION,
  SIGNATURE_MODES,
  buildAttestation,
  verifyAttestation,
} from "./attestation.js";

export {
  computeAttestationHash,
} from "./attestation-chain.js";

// aex-attestation/v2 — unambiguous named-envelope signing (see docs/security/ATTESTATION_ENVELOPE_V2.md).
// signAttestation() is the PREFERRED entry for new code; buildAttestation() (v1) is kept byte-for-byte
// for back-compat. Distinct from schema_version 2.0.0 (packaging) — this is the wire format version.
export {
  ATTESTATION_V2_VERSION,
  V2_DOMAIN,
  V2_KNOWN_BINDINGS,
  PREFERRED_WIRE_VERSION,
  AttestationV2Error,
  buildV2Envelope,
  v2SigningBytes,
  v2SigningText,
  v2CanonicalDigest,
  buildAttestationV2,
  verifyAttestationV2,
  verifyAttestationAny,
  signAttestation,
  verifyV1,
  verifyV2,
  assertSecureSecret,
  isProductionEnv,
  DEV_DEFAULT_SECRET,
} from "./attestation-v2.js";

// v3 M1.2: streaming evidence bundle API + crash-recovery.
export {
  EVENT_TYPES,
  createSession,
  appendEvent,
  sealSession,
  sealAndAnchor,
  sealPartialBundle,
  recoverSession,
  verifyBundle,
} from "./session.js";
export { createFileStore, listSessionFiles } from "./store-file.js";

// v3 M3 sprint 1 + 2 + 3: external anchoring (RFC 3161 TSA + Sigstore Rekor).
export {
  TRUST_LEVELS,
  trustLevelRank,
  buildTimestampRequest,
  parseTimestampResponse,
  requestTimestamp,
  verifyRfc3161Anchor,
  verifyCmsSignature,
  validateCmsCertChain,
  buildRekorHashedrekordEntry,
  submitRekorEntry,
  canonicalizeJson,
  extractRekorPayloadHash,
  rekorLeafHash,
  verifyInclusionProof,
  verifyRekorSet,
  verifyRekorAnchor,
} from "./anchors.js";
