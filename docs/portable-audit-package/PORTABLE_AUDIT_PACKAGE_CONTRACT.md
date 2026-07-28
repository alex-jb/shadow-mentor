# shadow-portable-audit-package/1.0 — contract

> Implemented per the committed discovery decision
> `SEPARATE_PORTABLE_PACKAGE_CLI_RECOMMENDED`
> (`PORTABLE_AUDIT_PACKAGE_RECOMMENDATION.md`). Fixture mode only.
> Producer/verifier: `bin/shadow-audit-package.mjs` + `lib/portable-audit-package.mjs`.

## Package directory layout (fixture mode)

```
<package-dir>/
├── manifest.json                          signed root (this contract)
├── presentation/shadow-flow-export.json   shadow-flow-export/1.0 — byte-identical to bin/shadow-flow-export.mjs output
├── evidence/evidence-bundle.json          shadow-evidence/v1 — existing sealed bundle, byte-preserved, never re-sealed
├── attestation/attestation.json           aex-attestation/v1 — OPTIONAL member (present only when supplied)
├── verification/verification-result.json  shadow-audit-package-verification/1.0 — DERIVED view, never evidence
├── provenance/runtime-manifest.json       shadow-audit-package-provenance/1.0
└── keys/
    ├── evidence-public-key.pem            spki-pem — verifies the evidence bundle signature
    └── package-public-key.pem             spki-pem — verifies the manifest signature (tamper-evidence only)
```

## Signed manifest fields

The signature covers `canonicalize(manifest minus signature)` under
`shadow-canon/1` (sorted-keys canonical JSON — the exact
`verify/verify-manifest.mjs` signing precedent, reused, not forked).

| Field | Meaning |
|---|---|
| `manifest_version` | `"shadow-portable-audit-package/1.0"` — gate; unknown versions are `UNSUPPORTED`, never best-effort |
| `package_id` | content-derived: `sha256(sorted member sha256 hashes joined by "\n")`; changes iff any member changes |
| `case_id` | the case identity (from the presentation narrative) |
| `bindings.case_id` | must equal `case_id` |
| `bindings.evidence_session_id` | the evidence bundle's `header.session_id` — **the manifest is the binding layer**; no member schema was changed to force this link |
| `source` | fixture identity, e.g. `"fixture:banking"` |
| `built_at` | caller-supplied ISO timestamp; defaults to the fixture's `fixture_timestamp` — **never wall clock** |
| `producer` | `{name, cli, version, build_commit}` — producer build/commit identity |
| `canonicalization_version` | `"shadow-canon/1"` |
| `signing.profile` | `"ed25519"` (closed; `hmac-*` ⇒ `NOT_PORTABLE`, anything else ⇒ `UNSUPPORTED`) |
| `signing.key_provenance` | `fixture \| operator \| production` — this increment produces `fixture` only |
| `signing.key_label` | e.g. `"FIXTURE RELEASE KEY"` |
| `signing.package_public_key_path` / `_fingerprint_sha256` | embedded key member + **full-length** SHA-256 SPKI fingerprint |
| `signing.evidence_public_key_path` / `_fingerprint_sha256` | same for the evidence key |
| `capability_boundary` | closed token list; `TAMPER_EVIDENCE_ONLY` and `SIGNATURE_IS_NOT_ANALYTICAL_CORRECTNESS` are mandatory; unknown tokens are `UNSUPPORTED` |
| `assets[]` | `{path, role, schema_version, byte_size, sha256}` sorted by path |
| `signature` | base64 Ed25519 over the canonical manifest minus this field |

## Member roles (closed)

`presentation | evidence | attestation | verification-derived | provenance | public-key`

- `presentation`, `evidence`, `verification-derived`, `provenance` are required and unique.
- `public-key` is required and may appear twice (evidence key + package key).
- `attestation` is optional (0 or 1).
- Allowed `schema_version` per role is a closed map; any other value is `UNSUPPORTED`.

## Completeness rules (two-way)

- Every declared member must exist with matching `byte_size` and `sha256`.
- Every file in the package directory must be `manifest.json` or a declared member — undeclared files are `UNEXPECTED_MEMBER`, never tolerated.
- Duplicate declared paths (exact or case-folded), traversal (`..`), absolute
  paths, backslashes, and the reserved path `manifest.json` are `PATH_UNSAFE`.
- Symlinks anywhere inside the package are `PATH_UNSAFE` — members are regular files only.
- Path comparison is byte-wise against `readdir` output, so behavior is
  deterministic on case-sensitive and case-insensitive filesystems alike.

## Derived-view boundary

`verification/verification-result.json` is **hash-listed for transit
integrity but is reproducible derived data, never evidence**. Consumers must
re-derive verification; a shipped copy that disagrees with the consumer's own
re-derivation is `VERIFIER_DISAGREEMENT` (the shipped copy is never preferred).

## Compatibility

- `shadow-flow-export/1.0`, `shadow-evidence/v1`, `aex-attestation/v1` are
  carried **unchanged**. The presentation member is byte-identical to
  `bin/shadow-flow-export.mjs --fixture banking` output and still imports
  through the existing Web flow-import pipeline unchanged (regression-pinned).
- The Flow export's honest-absence rule holds inside the presentation member:
  no `first_failure`, `downstream`, `approval`, `trust_posture`, `signature`,
  or `physical` fields — governance evidence rides in sibling members only.
- `shadow-verify-manifest-v1` is untouched; this contract is a new version
  reusing its signing primitives.
