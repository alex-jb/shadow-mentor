// packages/attest-core/index.js
// ─────────────────────────────────────────────────────────────────
// @shadow/attest-core — public API contract surface.
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
