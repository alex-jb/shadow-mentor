# Package verification behavior

`verifyPackageDir` (module) / `shadow-audit-package verify` (CLI) — the
independent verification path for `shadow-portable-audit-package/1.0`.
Fail-closed, deterministic, closed failure vocabulary.

## Check sequence

1. `manifest.json` present (`MANIFEST_MISSING`) and valid JSON (unreadable /
   unparsable manifest is I/O-class: CLI exit 3, nothing accepted).
2. `manifest_version` equals `shadow-portable-audit-package/1.0` —
   anything else is `UNSUPPORTED`, never best-effort.
3. Structural contract: `package_id` 64-hex, `case_id`, `bindings{...}`,
   `built_at`, `source`, `producer`, `canonicalization_version`, `signing`,
   non-empty `assets[]`, `capability_boundary` including the mandatory
   honesty tokens (`MANIFEST_MALFORMED`); unknown capability claims are
   `UNSUPPORTED`.
4. Declared-path safety before touching members: relative, forward-slash,
   no `..`, no absolute/drive paths, no backslash, not `manifest.json`,
   no exact or case-folded duplicates (`PATH_UNSAFE`).
5. Roles and schema versions from the closed sets; unique roles unique
   (`MANIFEST_MALFORMED`); required roles present (`INCOMPLETE`);
   unknown role/schema (`UNSUPPORTED`).
6. Signing profile: `ed25519` only; `hmac-*` is `NOT_PORTABLE`; anything
   else `UNSUPPORTED`; `key_provenance` from the closed vocabulary.
7. Package public key (out-of-band `--public-key`, else embedded member):
   unusable key material is `UNVERIFIABLE`; full-length SPKI SHA-256
   fingerprint must match the signed manifest (`KEY_FINGERPRINT_MISMATCH`).
8. Ed25519 signature over `canonicalize(manifest minus signature)`
   (`MANIFEST_SIGNATURE_MISSING` / `MANIFEST_SIGNATURE_FAILED`).
9. Two-way completeness over a recursive directory walk: symlinks are
   `PATH_UNSAFE`; declared-but-absent is `INCOMPLETE`; present-but-undeclared
   is `UNEXPECTED_MEMBER`.
10. Per-member `byte_size` then `sha256` (`TAMPERED`).
11. Bindings: `package_id` re-derives from member hashes; `bindings.case_id`
    = `case_id` = presentation member `case_id`; evidence
    `header.session_id` = `bindings.evidence_session_id`; member schema
    fields match declarations (`BINDING_MISMATCH`; hash-intact members that
    fail to parse are `MEMBER_MALFORMED`).
12. Internal evidence verification: evidence key member fingerprint check,
    HMAC rejection (`NOT_PORTABLE`), then a full independent
    `verifyBundle` run — chain, batch root, Ed25519 signature
    (`EVIDENCE_VERIFICATION_FAILED` carrying the verifier's closed reason,
    e.g. `prev_hash_mismatch`, `batch_root_mismatch`).
13. Attestation member (when declared): envelope version, ed25519 mode,
    signature presence (`ATTESTATION_INCONSISTENT`; HMAC `NOT_PORTABLE`).
14. Shipped verification-result vs a fresh re-derivation: any divergence —
    including a stronger claimed trust level or a different session — is
    `VERIFIER_DISAGREEMENT`. The shipped copy is never preferred.

## Failure classes (closed)

`MANIFEST_MISSING · MANIFEST_MALFORMED · UNSUPPORTED · PATH_UNSAFE ·
MANIFEST_SIGNATURE_MISSING · MANIFEST_SIGNATURE_FAILED · UNVERIFIABLE ·
KEY_FINGERPRINT_MISMATCH · INCOMPLETE · UNEXPECTED_MEMBER · TAMPERED ·
MEMBER_MALFORMED · BINDING_MISMATCH · NOT_PORTABLE ·
EVIDENCE_VERIFICATION_FAILED · ATTESTATION_INCONSISTENT ·
VERIFIER_DISAGREEMENT`

No generic success is ever reported while any internal member fails: the
verdict is `FAILED` if a single failure exists, and later dependent stages
are skipped rather than partially credited.

## What a passing verdict does and does not mean

- **Does** mean: the manifest signature verifies under the supplied/embedded
  key; every member is exactly as signed; the case↔session binding is
  internally consistent; the evidence bundle independently verifies.
- **Does NOT** mean: analytical or business correctness of the decision,
  key-identity trust (embedded keys give tamper-evidence only), Flow vendor
  import success, native Shadow Lens behavior, or any physical XR capability.
- A fixture-key package always reports `VERIFIED_FIXTURE_KEY`, never plain
  `VERIFIED`.

## Replay and staleness

A complete, untampered old package remains *valid but stale* — signature
verification cannot detect supersession. The mitigation is supersession
(a newer package referencing the prior `package_id`), a documented future
increment; signature revocation is not implemented.
