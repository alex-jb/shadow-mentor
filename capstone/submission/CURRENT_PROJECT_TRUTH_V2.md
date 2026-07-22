# CURRENT PROJECT TRUTH — V2

**Audited 2026-07-21** across the working tree and sibling worktrees. This file is the status ground truth for the V2 report and deck. Every status uses the V2 vocabulary; **authored / host-tested / built / device-validated are never collapsed into one word.** Values here are mirrored in `capstone-facts-v2.json`; the consistency test (`test/capstone-v2-consistency.test.mjs`) fails if the report or deck drifts from them.

## Why V1 was stale

V1 of the report and deck was built from the main-tree base commit **`5106799`**. Since then the work advanced on two sibling branches that are **not yet merged into that base**:

| Branch | Commit | What it adds |
|---|---|---|
| `feat/shadow-lens-explainers` | `19f52f0` | Three self-contained explainers (audit-chain, reason-code, persona), browser explainer integration, current test suite |
| `research/unity-threejs-spatial-ux-v2` | `bb33196` | `shadow-3d-scene-v1` shared scene contract + host test, Three.js four-layout spatial replay |

Because these branches diverge (neither contains the other), the project is described as their **union with per-capability branch/commit attribution** — not as any single tip. V1's `1,824 / 1,827` test count came from `5106799` and is **stale**.

## Test count — re-run, not reused

- **Current: 1,858 passed / 1,861 total / 3 skipped / 0 failed** — run on `feat/shadow-lens-explainers @ 19f52f0`, 2026-07-21.
- The 3 skips are **environment-gated** (Mistral OCR key / live-network / OpenSSL feature), not disabled coverage.
- **V1 said `1,824 / 1,827`.** Do not reuse that figure anywhere in V2.

## Claim → status table

| Claim | Status (V2 vocabulary) | Path | Branch @ commit | Evidence | V1 stale? |
|---|---|---|---|---|---|
| Canonical evidence schema (bundle v1) | **IMPLEMENTED · HOST-TESTED** | `spec/evidence-bundle.schema.json` | main @ `5106799` | schema + contract tests | no |
| Ed25519 signature (RFC 8032) | **HOST-TESTED** | `spec/attestation.schema.json` | main @ `5106799` | sign/verify tests | no |
| SHA-256 hash chain (FIPS 180-4) | **HOST-TESTED** | core lib | main @ `5106799` | chain-link tests | no |
| Tamper localization (first failed seq) | **HOST-TESTED** | core verifier | main @ `5106799` | tamper-cascade tests | no |
| Offline browser verifier | **BROWSER-RENDERED · BROWSER-RECORDED** (signing **FIXTURE-SIGNED**) | `verify.html` | main @ `5106799` | Playwright/Chromium 149, 0 external req | no |
| Verify-the-Verifier manifest | **BROWSER-RENDERED · FIXTURE-SIGNED** | verifier page | main @ `5106799` | "independent comparison NOT PERFORMED" surfaced | no |
| Bilingual EN + zh-CN | **BROWSER-RENDERED** | verifier + explainers | mixed | rendered both locales | no |
| MCP surface (11 tools) | **HOST-TESTED** | `mcp/` | main @ `5106799` | tool contract tests | count corrected → **11** |
| Claim–evidence graph | **HOST-TESTED** | `lib/claim-evidence-graph.mjs` | main @ `5106799` | graph tests | no |
| `shadow-3d-scene-v1` scene contract | **AUTHORED · HOST-TESTED** | `schemas/shadow-3d-scene-v1.schema.json` + `test/shadow-3d-scene-contract.test.js` | `research/unity-threejs-spatial-ux-v2` @ `bb33196` | contract test green; **Unity production integration still pending** | **new — absent in V1** |
| Three.js four-layout replay (arc, layered DAG, timeline, hybrid + 2D fallback) | **BROWSER-RENDERED · BROWSER-RECORDED · RESEARCH-PROTOTYPE** | Three.js app | `research/unity-threejs-spatial-ux-v2` @ `bb33196` | rendered + recorded stills | **new — absent in V1** |
| Explainer — audit chain | **HOST-TESTED · BROWSER-RENDERED** | `demos/animations` | `feat/shadow-lens-explainers` @ `19f52f0` | poster + integration render | **new — absent in V1** |
| Explainer — reason-code attestation | **HOST-TESTED · BROWSER-RENDERED** | explainers | `feat/shadow-lens-explainers` @ `19f52f0` | poster render | **new — absent in V1** |
| Explainer — persona deliberation | **HOST-TESTED · BROWSER-RENDERED** | explainers | `feat/shadow-lens-explainers` @ `19f52f0` | poster render | **new — absent in V1** |
| Unity Shadow Lens (3 workspaces + audit arc) | **UNITY-AUTHORED · DEVICE-VALIDATION-PENDING** | Unity project | authored | Unity **6000.0.23f1**; Unity test evidence reported separately; **no Beam Pro / XREAL device claim** | no |
| Android mock APK | **ANDROID-BUILT** (not device-validated) | `mock-stable-5168b07.apk` | frozen | 24,442,084 B · sha256 `93f2a81a…548d0b8` | no |
| Ingest audit — **structural** | **HOST-TESTED** | ingest audit | main @ `5106799` | structural seal of a third-party trace | wording fixed |
| Ingest audit — **semantic** | **SOURCE-AUTHORED** | ingest audit | main @ `5106799` | **semantic PRODUCTION evaluation pending — NOT device-pending** | wording fixed |
| Brier calibration | **HOST-TESTED** (post-hoc, n<100) | calibration lib | main @ `5106799` | not a coverage certificate | no |
| Five-perspective council | **IMPLEMENTED · HOST-TESTED** | council lib | main @ `5106799` | **deterministic fixture council**; persona value = **STANCE STRENGTH**, not confidence | wording fixed |
| Spatial comprehension benefit (RQ4) | **NOT IMPLEMENTED** | — | — | no user study conducted | no |

## Language corrections carried into V2

- **Council**: "includes a deterministic five-perspective fixture council for demonstration and testing" — **not** "ships a five-voice loan council." Persona numbers are **stance strength**, not confidence or probability of correctness.
- **Ingest audit**: "**structural ingest audit HOST-TESTED; semantic production evaluation PENDING**" — the semantic side is production-pending, **not** device-pending.
- **Signing**: fixture release key. **Fixture-signed ≠ production-signed.** No production signing key was generated.
- **Android**: **built, not device-validated.** No Beam Pro or XREAL device claim is made anywhere.
- **Scene contract**: **authored + host-tested**; Unity production integration is a Capstone II item.
