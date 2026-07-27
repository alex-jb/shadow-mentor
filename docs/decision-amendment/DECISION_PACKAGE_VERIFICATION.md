# Decision Package Verification (1.2)

Status: IMPLEMENTED. Source: `verifyPackageDir` in
`lib/portable-audit-package.mjs` (1.2 additions gated on `isV12` — 1.0 and 1.1
verification semantics are byte-for-byte untouched) and `verifyDecisionChain`
in `lib/decision-package.mjs`.

## Standalone verification (one directory)

Everything 1.1 verifies, plus:

| Check | Failure |
|---|---|
| `manifest_version` = `shadow-portable-audit-package/1.2` | `UNSUPPORTED` |
| `supersedes.marker` = `DECISION_AMENDMENT` (version-bound vocabulary; `FIXTURE_SUCCESSOR` is 1.1-only; `APPROVED` etc. never parse in any version) | `SUPERSESSION_MALFORMED` |
| exactly one member with role `decision`; forbidden below 1.2 | `INCOMPLETE` / `UNSUPPORTED` |
| decision member schema `shadow-decision-amendment/1`, hash + size bound through the signed manifest `assets[]` | `UNSUPPORTED` / `TAMPERED` |
| full member validation: closed keys, decision type, actor structure + fixture identity class, authorization status, type-specific content, reason fields, policy flags, mandatory status tokens, boundary string, text rules | `DECISION_MALFORMED`, `DECISION_TYPE_UNSUPPORTED`, `ACTOR_MISSING`, `ACTOR_ROLE_UNSUPPORTED`, `DECISION_REASON_MISSING`, `DECISION_REASON_CODE_UNSUPPORTED`, `DECISION_TARGET_MISSING`, `DECISION_TARGET_MISMATCH` |
| `decision_id` re-derivation (content hash + predecessor + case + target) | `DECISION_MALFORMED` |
| decision `predecessor` block ≡ signed `supersedes` block | `DECISION_TARGET_MISMATCH` |
| decision `case_id` / `evidence_session_id` ≡ manifest bindings | `CASE_MISMATCH` / `SESSION_MISMATCH` |
| every `referenced_evidence` entry resolves to an event (by seq + payload_hash) in THIS package's evidence bundle | `REFERENCED_EVIDENCE_MISSING` / `SESSION_MISMATCH` |
| provenance/1.2 mirrors the supersedes block and records `member_contracts.decision` | `BINDING_MISMATCH` |

**An invalid decision member never yields package success**: any decision
failure makes the package verdict `FAILED`. The success verdict remains
`VERIFIED_FIXTURE_KEY` (never generic `VERIFIED` under a fixture key).

## Distinct result axes (never collapsed)

1. **Package integrity** — `ok` / `verdict` / `failures[]` (above).
2. **Actor identity + authorization** — reported as `summary.decision.annotations
   = ["ACTOR_IDENTITY_UNVERIFIED", "DECISION_AUTHORITY_UNVERIFIED"]` on every
   verified 1.2 package. These are permanent fixture-mode ANNOTATIONS: they
   never fail integrity and integrity success never upgrades them.
3. **Business lifecycle** — never computed by standalone verification; it is
   a chain-level derived view (DECISION_LIFECYCLE_DERIVATION.md).

## Chain-level verification (`verifyDecisionChain` / `verify-chain`)

On top of the unchanged supersession chain verification:

- **Target-object binding against real predecessor bytes**: `council_decision`
  targets are re-derived from the predecessor's presentation member and the
  extract hash compared (`TARGET_OBJECT_MISMATCH` on substitution);
  `prior_decision` targets are compared against the predecessor's decision
  member bytes and id.
- **Duplicates / replays**: one decision_id may appear once across the
  supplied set (`DECISION_DUPLICATE` / `DECISION_REPLAYED`).
- **Conflicts**: a fork whose branches carry decisions → `DECISION_CONFLICT`;
  both branches are reported, neither is chosen, no timestamp or import-order
  tiebreak exists.
- **Lifecycle**: derived only when the chain and all decision bindings verify;
  otherwise `state: null` with an honest note — an unverified chain never
  produces a business state.
