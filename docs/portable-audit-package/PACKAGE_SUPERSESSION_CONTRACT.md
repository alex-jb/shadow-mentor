# Package Supersession Contract — `shadow-portable-audit-package/1.1`

Decision record: [PACKAGE_SUPERSESSION_ADR.md](./PACKAGE_SUPERSESSION_ADR.md).
Base contract (unchanged): [PORTABLE_AUDIT_PACKAGE_CONTRACT.md](./PORTABLE_AUDIT_PACKAGE_CONTRACT.md).

## What 1.1 is

`shadow-portable-audit-package/1.1` = the 1.0 package contract **plus exactly one
mandatory signed `supersedes` block** in the manifest, and a provenance member on schema
`shadow-audit-package-provenance/1.1` that repeats that block verbatim.

- **Standalone packages are still 1.0.** `create` without `--supersedes` emits 1.0 bytes
  identical to the `ced8c2c` baseline.
- **Successor packages are 1.1.** A 1.1 manifest without a `supersedes` block is
  `SUPERSESSION_MALFORMED`; a 1.0 manifest is never a successor.
- **1.0 is unchanged in place.** No field was added, no semantic moved, and standalone
  1.0 verification behaves exactly as at baseline.

## The signed `supersedes` block

Inside the signed manifest bytes (Ed25519 over the canonical manifest minus `signature`):

```json
"supersedes": {
  "relation": "shadow-package-supersession/1",
  "predecessor_package_id": "<64-hex — prior package content id>",
  "predecessor_manifest_sha256": "<64-hex — sha256 over the prior manifest.json FILE bytes>",
  "predecessor_manifest_version": "shadow-portable-audit-package/1.0",
  "predecessor_case_id": "case-2026-Q3-0042",
  "predecessor_evidence_session_id": "reference-banking-decision-2026-001",
  "marker": "FIXTURE_SUCCESSOR"
}
```

Field semantics:

| Field | Binds | Rule |
|---|---|---|
| `relation` | link type | closed vocabulary: `shadow-package-supersession/1` only |
| `predecessor_package_id` | prior content identity | 64-hex; ≠ own `package_id` (`SELF_REFERENCE` otherwise) |
| `predecessor_manifest_sha256` | prior signed-manifest identity (signature included) | any byte change to the prior manifest — even signature-preserving whitespace — breaks the link |
| `predecessor_manifest_version` | prior contract version | must be in the supported set at chain time (`UNSUPPORTED_TRANSITION`) and must match the actual predecessor |
| `predecessor_case_id` | same-case rule | MUST equal the successor's own `case_id` (self-checkable standalone) and the actual predecessor's case (chain-checkable) |
| `predecessor_evidence_session_id` | prior evidence session | string when available; `null` = not asserted (the chain then skips the session-relation check) |
| `marker` | successor kind | closed vocabulary: `FIXTURE_SUCCESSOR` only — a **neutral fixture marker**, never Human Review / Approval / Rejection |

Everything the spec requires is inside signed bytes: current package id
(`package_id`), prior package id + manifest identity, case id, current evidence session
(`bindings.evidence_session_id`), prior evidence session, relation + contract versions,
producer/build identity (`producer`), and explicit fixture-only provenance
(`signing.key_provenance = "fixture"`, `FIXTURE_ONLY`, `marker`).

## Additional 1.1 requirements

- `capability_boundary` MUST additionally declare `SUPERSESSION_IS_NOT_GLOBAL_LATEST`.
- The provenance member (`provenance/runtime-manifest.json`) MUST use
  `shadow-audit-package-provenance/1.1` and carry `supersession` canonically equal to the
  manifest's `supersedes` block (`BINDING_MISMATCH` on divergence). This also guarantees a
  successor's member bytes always differ from its predecessor's, so the content-derived
  `package_id` always differs.
- `package_id` derivation is unchanged: sha256 over the sorted member sha256 list.

## Immutability rules

- A successor is a **new immutable package**. Creating it never reads-modifies-writes the
  predecessor; the CLI refuses `--output-dir` == `--supersedes` even with `--force`.
- The predecessor remains byte-for-byte unchanged, independently verifiable, and is
  **never invalidated** by being superseded.
- Supersession does not erase earlier evidence and does not prove business correctness.
- A valid chain head is the head of the *supplied, locally observed* chain only — never a
  claim of globally latest or freshest.

## Version transitions

| Successor | Predecessor | Result |
|---|---|---|
| 1.1 | 1.0 | supported |
| 1.1 | 1.1 | supported |
| 1.1 | anything else | `UNSUPPORTED_TRANSITION` |
| 1.0 | (any) | 1.0 cannot be a successor; supersedes-shaped data in a 1.0 manifest is `SUPERSESSION_MALFORMED` at chain level, while standalone 1.0 verification is untouched |

## Relation to future Human Review / Approval

This contract deliberately encodes **no** review/approval/rejection semantics. A future
bounded increment adds new `relation`/`marker` vocabulary entries (e.g. a review-outcome
successor) on top of exactly this link mechanism. Nothing in this increment mutates
business state.
