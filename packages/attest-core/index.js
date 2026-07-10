// packages/attest-core/index.js
// ─────────────────────────────────────────────────────────────────
// @shadow/attest-core — public API contract surface.
//
// This package intentionally re-exports from ../../lib during the
// v2.0.0-rc → v2.0.0 stabilization window. A dedicated CI test
// (test/attest-core-contract.test.js) verifies:
//
//   1. Every symbol re-exported below actually resolves.
//   2. None of the source files reachable from this entry point
//      import any LLM SDK (anthropic, openai, google-genai, etc).
//
// After v2.0.0 the physical files will be moved into this directory
// and lib/ will re-export in the opposite direction. That flip is
// invisible to consumers because they import from this package.
//
// ─────────────────────────────────────────────────────────────────

export {
  ATTESTATION_VERSION,
  SIGNATURE_MODES,
  buildAttestation,
  verifyAttestation,
} from "../../lib/attestation.js";

export {
  computeAttestationHash,
} from "../../lib/attestation-chain.js";
