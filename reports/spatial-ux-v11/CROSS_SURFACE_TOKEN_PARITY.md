# Cross-surface semantic token parity (V11 increment)

One canonical semantic-token source now governs meaning across surfaces. **Meaning is unified, layout is
not** — each surface keeps its own exact shades/geometry, but the semantic HUE and the distinctness rules
are pinned by tests so they cannot drift.

## Canonical source
`design/shadow-spatial-tokens.json` (**v2**). Six semantic categories, each state carrying
colour + icon + shape + EN/ZH text + a11y(EN/ZH):
- **status** (verification): VERIFIED · TAMPERED · FAILED · WARNING · NOT_VERIFIED · NOT_CHECKED ·
  NOT_PRESENT · NOT_EVALUATED · UNSUPPORTED · **FIRST_FAILURE** · **DOWNSTREAM_AFFECTED**
- **governance**: REQUIRES_HUMAN_REVIEW · HUMAN_REVIEW_RECORDED · APPROVAL_NOT_PRESENT · APPROVAL_PRESENT · ABSTAINED
- **trust_posture**: SELF_SIGNED · TIME_ANCHORED_STRUCTURAL · TIME_ANCHORED
- **tracking**: INITIALIZING · SCANNING · TRACKED_3DOF · TRACKED_6DOF · LIMITED · LOST · RECOVERING
- **interaction**: DEFAULT · FOCUSED · SELECTED · CONFIRM_REQUIRED · DISABLED
- **capability**: AUTHORED · COMPILED · BUILT · INSTALLED · DEVICE_VALIDATED · PRODUCTION_READY

Extended deterministically by `scripts/extend-canonical-tokens.mjs` (idempotent; byte-identical on repeat).

## Permanent colour meanings (pinned by tests)
- **GREEN** — cryptographic/integrity verification ONLY (VERIFIED, TRACKED_3DOF/6DOF, TIME_ANCHORED,
  DEVICE_VALIDATED, PRODUCTION_READY). Never business approval, never a persistent healed state.
- **RED** — verification failure / tamper / broken evidence.
- **AMBER** — warning, limited capability, **scanning**, caution.
- **BLUE** (brand accent) — focus, selection, human action required, **approval** (with an explicit stamp).
- **NEUTRAL** — not evaluated, not present, inactive/historical, downstream-affected.

## What the tests enforce
Node `test/token-semantic-parity.test.js` (10) + Unity EditMode `ShadowTokenParityTests` (3):
- never colour alone — every state has text + zh + icon + shape + colour + a11y(EN/ZH).
- verification-green used only by the verification/validated family.
- APPROVAL_PRESENT ≠ verification-green; carries a stamp glyph; ≠ review-recorded.
- FIRST_FAILURE ≠ DOWNSTREAM_AFFECTED (colour + glyph); NOT_EVALUATED ≠ FAILED.
- SELF_SIGNED ≠ TIME_ANCHORED_STRUCTURAL ≠ TIME_ANCHORED (each disclosed).
- SCANNING amber ≠ LOST red; seven distinct tracking states.
- Unity hues hold across all five visual profiles; green never reused for Tampered/Warning/Neutral/Info.
- cross-surface scan: Ambient Council approve is not verification-green; spatial-finance analysis confidence
  is not verification-green.

## Token codegen increment (follow-on)
The hand-mirrored surfaces are now **generated** from the canonical JSON — `scripts/generate-tokens.mjs` →
Unity C# + Three.js JS + browser CSS, guarded by `test/token-codegen.test.js` (deterministic, stale-detection).
The one deliberate colour deviation (Three.js Audit Room gray-verified) is resolved as the named
`AuditRoomProvenance` profile and pinned by `test/threejs-profile-override.test.js`. Offline review page at
`token-review/index.html`. See TOKEN_CODEGEN_IMPLEMENTATION.md, TOKEN_PROFILE_OVERRIDE_POLICY.md,
TOKEN_VISUAL_REVIEW.md, TOKEN_CODEGEN_REMAINING_GAPS.md.

## §14 status flags
CANONICAL-TOKEN-SOURCE-CONFIRMED ✅ · TOKEN-SOURCE-INVENTORY-COMPLETE ✅ · CROSS-SURFACE-STATUS-PARITY-PASSED ✅
CANONICAL-TOKEN-CODEGEN-COMPLETE ✅ · UNITY/THREEJS/BROWSER-CSS-TOKENS-GENERATED ✅ · CODEGEN-DETERMINISTIC ✅
STALE-GENERATED-FILES-DETECTED ✅ · PROFILE-OVERRIDES-EXPLICIT ✅ · THREEJS-VERIFIED-DIVERGENCE-RESOLVED ✅
TOKEN-REVIEW-PAGE-COMPLETE ✅
VERIFICATION-GREEN-UNIFIED ✅ · APPROVAL-SEPARATED-FROM-VERIFICATION ✅ · HEALED-TRANSIENT-SEMANTICS-CONFIRMED ✅
FIRST-FAILURE-DOWNSTREAM-DISTINCT ✅ · REVIEW-APPROVAL-DISTINCT ✅ · TRUST-POSTURE-DISTINCT ✅
TRACKING-STATE-DISTINCT ✅ · ENGLISH-CHINESE-TOKEN-PARITY-PASSED ✅ · UNITY-TOKEN-PARITY-PASSED ✅
BROWSER-TOKEN-PARITY-PASSED ✅ (scan) · FULL-NODE-SUITE-PASSED ✅ · UNITY-EDITMODE-PASSED ✅
SEMANTIC-HASHES-UNCHANGED ✅ · STABLE-APK-UNCHANGED ✅ · FROZEN-VERIFIER-UNCHANGED ✅
Kept false: BEAM-PRO-VISUAL-VALIDATED · OST-READABILITY-DEVICE-VALIDATED · XREAL-3DOF/EYE-6DOF-DEVICE-VALIDATED ·
PRODUCTION-READY · FORMAL-USER-STUDY-COMPLETED.
