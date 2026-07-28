# Next implementation increment (bounded — not implemented in this task)

**One increment:** add the Core-owned package CLI in fixture mode.

## Scope

- New `bin/shadow-package-audit.mjs` (name final at implementation) + npm alias.
- New manifest contract `shadow-portable-audit-package/1.0` (new version string;
  `shadow-verify-manifest-v1` untouched), reusing `verify/verify-manifest.mjs`
  primitives + `shadow-canon/1`, extended with: `package_id`, `case_id`,
  `bindings.evidence_session_id`, `assets[]{path,sha256,role,schema_version}`,
  `key_provenance`, caller-supplied `built_at`, full-length key fingerprint,
  two-way completeness rule.
- Members in fixture mode: presentation from `--fixture banking` (via the existing
  flow-export CLI/lib, unchanged); evidence from an **existing** fixture-signed
  `shadow-evidence/v1` bundle input (never re-sealed); optional attestation member;
  derived `verification/verification-result.json` via `verifyBundle`; generated
  `provenance/runtime-manifest.json`.
- Exit codes and validate-before-write/temp+rename discipline copied from the
  flow-export CLI; `--json` summary; `--force` overwrite rule.
- Tests: items 1–24 of `PACKAGE_TEST_STRATEGY.md` (25–28 belong to the later Web
  increment).
- Docs: contract doc + security-model deltas (which drifts from
  `PACKAGE_CONTRACT_GAP.md` §Cross-cutting were resolved vs explicitly scoped out).

## Preconditions / decisions to confirm at implementation start

1. case_id ↔ evidence_session_id binding field (product decision — approved by
   adopting the recommendation, exact field names to freeze in the contract doc).
2. Whether event payload contents may ever be included (default: NO — hash-bound
   payloads stay out; flag-gated future).
3. Package delivery form for the browser (directory vs single-envelope) — may be
   deferred; the CLI writes a directory either way.

## Hard boundaries carried forward

No changes to `shadow-flow-export/1.0`, `shadow-evidence/v1`, `aex-attestation/v1`,
or any existing CLI's interface; no new signing system; no Web/Flow/Lens changes;
no backend/database/network; no live model calls; fixture keys labeled; no
business-correctness or physical-XR claims; control-plane registration happens via
a separate control-plane update after delivery.
