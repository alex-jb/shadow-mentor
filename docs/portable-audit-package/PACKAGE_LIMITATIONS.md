# Package limitations (honest list — fixture-mode increment)

- **Signature validity does not prove analytical or business correctness.**
  It proves the package is exactly what its producer signed. Nothing more.
- **Fixture keys are not production keys.** The manifest signing key is the
  repo-committed FIXTURE RELEASE KEY; anyone can sign with it. Fixture
  packages prove internal consistency and demonstrate the verification
  machinery; they carry `key_provenance: "fixture"` end-to-end and verify as
  `VERIFIED_FIXTURE_KEY`, never `VERIFIED`.
- **Key rotation is not implemented.** Future requirement: key_id + grace
  windows per the existing attestation convention.
- **Key revocation is not implemented.** No expiry, CRL, or OCSP exists
  anywhere in the evidence stack; a leaked operator key would require
  out-of-band communication.
- **Replay of a complete old package is valid-but-stale.** Supersession
  (a newer manifest referencing the prior `package_id`) is the planned
  mitigation, not signature revocation. Not implemented in this increment.
- **Business First Failure and downstream consequences may remain absent.**
  Core does not produce them; the package never synthesizes them. Only
  integrity-level failure information (from the verifier) exists. Honest
  absence is preserved through the presentation member's forbidden-keys rule.
- **Approval and Trust Posture are never package fields.** Approval exists
  only as an evidence event slot; trust posture only as verifier output
  inside the derived view.
- **Flow vendor import is not proven.** The presentation member is
  byte-compatible with `shadow-flow-export/1.0`; actual third-party vendor
  ingestion remains unproven.
- **Native Shadow Lens behavior is not proven.** No Lens/Unity surface was
  touched or exercised.
- **No physical XR capability claims** can ride a package; the capability
  vocabulary has no such token and unknown tokens are rejected.
- **Embedded public keys give tamper-evidence only.** Key-identity trust
  needs out-of-band fingerprint comparison.
- **Payload contents stay out.** Event payloads are hash-bound and off-chain;
  the reference payload file is intentionally not packaged (product decision
  default NO; a future flag-gated increment would be needed to change this).
- **Known Core schema/code drifts are not repaired here** (event enum 13 vs
  18, attestation `version` vs `spec_version`, anchor kinds, raw-seed
  encodings, attest-core README network claim). The package passes evidence
  bytes through untouched and binds them by hash; those drifts remain open
  items tracked in `PACKAGE_CONTRACT_GAP.md`.
- **Single-signature verification.** `verifyBundle` reads `signatures[0]`
  only; multi-signature rotation stories are not honored anywhere yet.
- **Canonicalization caveats.** `shadow-canon/1` diverges from RFC 8785 on
  `-0` and JS-native number formatting (documented in the JCS tests).
- **No production-security or regulatory-compliance claim** is made by this
  increment, its docs, or its outputs.
