// lib/attestation.js — v2.0.0 back-compat shim.
//
// The source moved to packages/attest-core/attestation.js in v2.0.0
// (2026-07-10). This shim re-exports every symbol the pre-v2 lib/
// path exposed so existing imports of `lib/attestation.js` keep
// resolving without changes.
//
// New code should import from `shadow-attest-core` (or the local
// relative path `packages/attest-core/`). This shim will be removed
// in a future major version.

export * from "../packages/attest-core/attestation.js";
export * from "../packages/attest-core/attestation-v2.js";
