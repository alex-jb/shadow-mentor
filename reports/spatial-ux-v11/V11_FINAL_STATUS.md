# V11 — deep-audit convergence status (this phase)

Branch `feat/shadow-spatial-ux-asset-audit-v11`. Consolidates the deep-audit reconciliation + fixes phase.
Honest: this is the P0 concrete-defect + report-reconciliation portion of the 28-section spec — the large
design-convergence (Audit Workspace primary UI, cross-surface token parity, tracking wiring, OST positive/
negative, CJK wrapping, graphical PlayMode lane) is the next multi-session increment.

## §28 status flags (honest)
| Flag | Value |
|---|---|
| TWO-REPORT-RECONCILIATION-COMPLETE | ✅ (the two PDFs are byte-identical — ONE report; fully reconciled) |
| ATTEST-METADATA-VERSION-CORRECT | ✅ (derived from package.json + contract test) |
| UNTRUSTED-INNERHTML-REMOVED | ⚠️ PARTIAL (demo/xreal.html done + browser-verified; spatial-finance is fixture-only STATIC_TRUSTED, documented, escape-at-API-boundary deferred) |
| THREEJS-ALLOCATIONS-REDUCED | ✅ (scene.js scratch vectors; 0 per-frame alloc) |
| HIT-PROXY-DRAW-COST-REMOVED | ✅ (visible=false; raycast-parity test on r160) |
| AMBIENT-COUNCIL-DEFECTS-RESOLVED | ✅ (badge overlap 0, multiline clamp, approval≠verified-green + ✓ stamp, responsive) |
| GUIDED-STORY-CONSUMES-OST-BRIGHT | ✅ (dark text + bright backplate; EditMode 120/120) |
| CROSS-SURFACE-STATUS-TOKENS-UNIFIED | ❌ (Ambient Council approval-green fixed as a start; full parity NOT done) |
| AUDIT-WORKSPACE-IMPLEMENTED | ❌ (next increment) |
| EVIDENCE-RAIL-IMPLEMENTED | ❌ |
| TRACKING-STATE-PRESERVATION-PASSED | ❌ (state machine exists + pinned; render-controller wiring not done) |
| OST-POSITIVE-AUTHORED / OST-NEGATIVE-AUTHORED | ⚠️ XrealOstBright exists; distinct positive/negative pair NOT split |
| CJK-WRAPPING-PASSED | ❌ (Intl.Segmenter fix deferred) |
| GRAPHICAL-PLAYMODE-LANE-COMPLETE | ❌ (8 pre-existing failures characterized, lane not built) |
| FULL-NODE-SUITE-PASSED | ✅ 1992 / 1989 pass / 0 fail / 3 skip |
| UNITY-EDITMODE-PASSED | ✅ 120 / 120 |
| SEMANTIC-HASHES-UNCHANGED | ✅ (V1/V2 signing semantics untouched; only the metadata version FIELD now correct) |
| STABLE-APK-UNCHANGED | ✅ | FROZEN-VERIFIER-UNCHANGED | ✅ |

### Kept false (no device evidence exists)
BEAM-PRO-INSTALLED · XREAL-LOADER-DEVICE-VALIDATED · XREAL-3DOF/EYE-6DOF-DEVICE-VALIDATED ·
BEAM-PRO-CONTROLLER-VALIDATED · DEVICE-TTS-VALIDATED · CAMERA-FRAME-VALIDATED · OCR-DEVICE-VALIDATED ·
OST-READABILITY-DEVICE-VALIDATED · DEVICE-PERFORMANCE-MEASURED · PRODUCTION-READY ·
INDEPENDENT-CRYPTO-AUDIT-COMPLETED · FORMAL-USER-STUDY-COMPLETED — **all false**.

## Commits this phase
- `b516dfa` reconcile report + P0-1 attest metadata, P0-2 alloc, P0-3 hit-proxy, P1-5 xreal innerHTML
- `9d054dd` CORS no-credentials-with-wildcard invariant + prod-allowlist doc
- `37ea94f` Ambient Council layout (badge/clamp/approval/responsive)
- `adb27c3` guided-story consumes XREAL_OST_BRIGHT (dark-on-bright backplate)

## Increment log (this branch, ordered)
1. ✅ **Cross-surface semantic token parity** (Unity/Three.js/CSS) + tests — approval never reuses verification green anywhere. (CROSS_SURFACE_TOKEN_PARITY.md)
1.5. ✅ **Token codegen + visual review** — JSON is now the generated single source (Unity C# + JS + CSS via
   `scripts/generate-tokens.mjs`, deterministic + stale-guarded); Three.js gray-verified resolved as the named
   `AuditRoomProvenance` profile; offline token-review page. **This is the "TOKEN CODEGEN AND REVIEW INCREMENT",
   NOT the completion of V11.** (TOKEN_CODEGEN_IMPLEMENTATION.md, TOKEN_PROFILE_OVERRIDE_POLICY.md, TOKEN_VISUAL_REVIEW.md, TOKEN_CODEGEN_REMAINING_GAPS.md)

1.6. ✅ **Flow-inspired presentation-contract increment** — borrowed two validated Flow spatial-design
   patterns (anchored annotation + leader line; explicit sequence/time axes) into the Audit Room, and
   added a Shadow-owned presentation contract so any surface (Flow/Unity/Three.js/2D) renders the same
   evidence WITHOUT becoming the source of truth: presentation snapshot v1 + claim bindings + manifest
   v1 + edit-classification policy + honest Trust Capsule prototype + a DESIGN-ONLY Flow adapter doc.
   +25 tests. **Presentation is a derived view, never canonical evidence.** No Flow integration/
   partnership/API claimed. (FLOW_INSPIRED_INCREMENT_STATUS.md, FLOW_SHADOW_RESPONSIBILITY_BOUNDARY.md,
   PRESENTATION_EDIT_POLICY.md, TRUST_CAPSULE_PROTOTYPE.md, SHADOW_FLOW_PRESENTATION_ADAPTER.md)

2. ✅ **Audit Workspace core V1** — the primary Unity product UI. **Correction: Unity IS available**
   (6000.0.23f1 at the exact Hub path; the prior "no Unity" claim was a PATH-only check — see
   UNITY_TOOLCHAIN_DISCOVERY.md). Implemented as real runtime components (`ShadowAuditWorkspace`
   MonoBehaviour + pure model/glyph/metrics/mode/tracking), consuming generated Unity semantic tokens,
   default view, PrimitiveDiagnostic preserved. **Unity batchmode EditMode: 133/133 pass, 0 fail**
   (10 new ShadowAuditWorkspaceTests). Visual PlayMode captures + browser acceptance are the remaining
   in-increment verifiable steps. (AUDIT_WORKSPACE_ARCHITECTURE.md, AUDIT_WORKSPACE_INCREMENT_STATUS.md,
   AUDIT_WORKSPACE_TOKEN_CONSUMPTION.md, AUDIT_WORKSPACE_TRACKING_FALLBACK.md, AUDIT_WORKSPACE_REMAINING_GAPS.md)

2.9. ✅ **AUDIT WORKSPACE GRAPHICAL ACCEPTANCE COMPLETE** — real Unity graphics-mode PlayMode captures
   of the workspace (BEFORE overlap → AFTER readable), 4 crowding defects fixed, full 14-state matrix +
   representative zh/OST/HighContrast (32 PNGs + 6 contact sheets), Chinese localized
   (ShadowWorkspaceLabels + generated-token values), and the final gating item closed:
   `ShadowAuditWorkspaceLifecycleTests` (PlayMode 1/1) programmatically proves repeated updates +
   destroy/recreate do not leak or duplicate objects (regions=5, uniqueMats=4 fixed, recreate==baseline).
   EditMode 136/136. Non-blocking limits kept explicit (minor center/right spacing, role-value l10n, OST
   simulated only). (AUDIT_WORKSPACE_GRAPHICAL_ACCEPTANCE.md + RUNTIME_INVENTORY.md + LOCALIZATION.md +
   BEFORE_AFTER.md + PROFILE_REVIEW.md)

3.0. ✅ **AUDIT ROOM FLAT COMPOSITION + INSPECTOR READABILITY** — brought the Three.js Flat mode from
   correct-placement to visually accepted (real Chromium): deterministic fit-to-content camera (rail
   ~80% width across 1920/1680/1440/1366/2560, `flat-fit.js` 4/4 tests), selected-record hierarchy
   (scale + bright edge + dim others), readable inspector (title + layered body, OPEN 2D AUDIT), a
   distinct white elbow leader + endpoint dot, an in-scene Trust header (INTEGRITY/TRUST/CORRECTNESS,
   not one green "valid"), and a first-entry hint. Runtime cleanup: 1 leader after 32 selects, 0
   orphans; console 0; external requests 0. Node 2039/0/3. (AUDIT_ROOM_FLAT_ACCEPTANCE_STATUS.md)

## Next increment (ordered)
- Three.js Time Mode runtime integration (wire the tested `axis-layout.js` into the now-stable Flat scene) + Time Mode browser acceptance.
3. Tracking-health → presentation auto-fallback wiring + state-preservation tests.
4. Graphical PlayMode lane for the 8 headless-incompatible tests (RequiresGraphicsContext).
5. CJK wrapping (Intl.Segmenter); OST positive/negative split; spatial-finance API-boundary escaping.
