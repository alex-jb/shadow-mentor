# Recommendation — separate portable package CLI

**Decision: `SEPARATE_PORTABLE_PACKAGE_CLI_RECOMMENDED`** (option B).

One new thin, offline, deterministic Core-owned CLI (working name
`bin/shadow-package-audit.mjs`) that **composes existing producers and signs one
manifest**, under a new versioned contract `shadow-portable-audit-package/1.0`.

## Why B

1. **Zero duplication.** Every member already has an authoritative producer:
   presentation = `bin/shadow-flow-export.mjs` @213ebe66 (`shadow-flow-export/1.0`,
   unchanged); evidence = an existing sealed `shadow-evidence/v1` bundle (the CLI
   *accepts* one — it never re-runs a council or re-seals); attestation =
   `aex-attestation/v1` (optional member); verification-result = re-derived via
   `verifyBundle`/`bin/shadow-verify.mjs --json`; manifest primitives =
   `verify/verify-manifest.mjs` (`buildManifest/signManifest/verifyManifestSignature/checkAssets`),
   extended under a **new** manifest version — the existing
   `shadow-verify-manifest-v1` is not changed.
2. **Authority boundaries stay clean.** `shadow-flow-export/1.0` semantics untouched
   (its honest-absence FORBIDDEN_KEYS rule keeps holding *inside* the presentation
   member; governance evidence rides in *sibling* members, which is exactly the split
   the Web repo's own boundary docs call for: a "versioned portable audit payload"
   that "must never be able to change canonical evidence"). The verifier stays a
   pure consumer.
3. **Repo convention.** Thin single-purpose CLIs with documented exit codes,
   validate-before-write, atomic temp+rename, `--json` summaries, bare-env
   testability — the flow-export CLI is the direct template.
4. **Composes forward.** The Web local runner already spawns allowlisted Core CLIs;
   a desktop/Tauri shell composes the same way. If a second in-process consumer
   appears, extract `packages/package-core` then (option E as a later refactor).

## Required manifest additions (new version, reusing the signed-manifest pattern)

- `manifest_version: "shadow-portable-audit-package/1.0"`
- `package_id` (content-derived: sha256 over sorted member hashes)
- `case_id` + explicit case↔session binding (`bindings: {case_id, evidence_session_id}`) — **new product decision, approved as part of implementing this recommendation**
- `assets[]{path, sha256, role, schema_version}` (role ∈ presentation | evidence | attestation | verification-derived | provenance | public-key)
- `key_provenance: fixture | operator | production` + full-length public-key fingerprint(s)
- `built_at` supplied by the caller (deterministic; never wall-clock default)
- signature: Ed25519 over `canonicalize(manifest minus signature)` (`shadow-canon/1`)
- consumer rule (documented in-contract): **two-way completeness** — reject missing
  members *and* unlisted files; treat the shipped verification-result as reproducible
  derived data, never evidence.

## Bounded next increment (do not implement in this task)

`NEXT_IMPLEMENTATION_INCREMENT.md` specifies the single next step: the package CLI
in fixture mode (banking fixture presentation + an existing fixture-signed bundle +
ephemeral fixture key, explicitly labeled), with the test set from
`PACKAGE_TEST_STRATEGY.md`, no Web changes, no contract changes to existing
producers.

## Explicit non-goals carried from the boundaries

No new signing system (Ed25519 + shadow-canon/1 reused); no second flow-export
schema; no change to `shadow-flow-export/1.0`; no backend/database; no live model
calls; no business-correctness claim; no physical XR claim; fixture keys remain
demo-labeled.
