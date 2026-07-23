# Audit Workspace — graphical acceptance

**Status: COMPLETION PASS — the 4 confirmed crowding defects are fixed, all 14 DesktopDark states +
representative zh/OST/HighContrast captured, Chinese localized. Minor residuals remain (documented).
NOT device validated.**

## Completion pass (this increment)
Fixed the 4 confirmed defects (header/tracking separation + a `tracking: UNKNOWN STATUS` bug, Source
Card spacing, Trust Strip clipping, Chinese field-label localization), captured the full matrix (32
PNGs, `<state>__<lang>__<profile>.png`), and generated 6 contact sheets. See
AUDIT_WORKSPACE_BEFORE_AFTER.md, AUDIT_WORKSPACE_LOCALIZATION.md, AUDIT_WORKSPACE_PROFILE_REVIEW.md,
AUDIT_WORKSPACE_CAPTURE_MANIFEST.json. Unity graphics-mode PlayMode 1/1; EditMode 136/136 (+3
localization tests). BEFORE-overlap/ + INTERMEDIATE-partial/ preserved as failure evidence.

Completion flags: AUDIT-WORKSPACE-ALL-DESKTOP-STATES-CAPTURED ✅ · AUDIT-WORKSPACE-PROFILE-CAPTURES-COMPLETE ✅
(representative) · AUDIT-WORKSPACE-CONTACT-SHEETS-COMPLETE ✅ · HEADER-TRACKING-SEPARATION-PASSED ✅ ·
SOURCE-CARD-CROWDING-RESOLVED ✅ · TRUST-STRIP-CLIPPING-RESOLVED ✅ · CJK-GLYPH-RENDERING-PASSED ✅ ·
CHINESE-LOCALIZATION-COMPLETE ✅ (label+status layer; role-value residual) · TRACKING-STATES-VISUALLY-DISTINCT ✅.
Still honest-false: WORKSPACE-REPEATED-UPDATE-CLEANUP-PASSED (code paths present, not count-asserted —
see AUDIT_WORKSPACE_RUNTIME_INVENTORY.md); OST-READABILITY-DEVICE-VALIDATED; all device flags.

---
## (earlier) first graphical pass — kept for history
**Status was: GRAPHICALLY RENDERED + core readability PASS after a bounded layout correction.**

## Method (real runtime, not a mock)
`Tests/PlayMode/ShadowAuditWorkspaceCaptureHarness.cs` (env-gated `SHADOW_CAPTURE=1`) instantiates the
REAL `ShadowAuditWorkspace` MonoBehaviour, removes AutoBoot contamination, binds a sanitized in-code
Banking model (income → dti → **decision=FIRST_FAILURE** → pricing=AFFECTED_DOWNSTREAM), assigns a
CJK-capable OS font, and renders through a camera into a RenderTexture → PNG. Ran in Unity 6000.0.23f1
graphics-mode PlayMode: **1/1 pass**. Output: `media/spatial-ux-v11/audit-workspace/` (7 states).

## BEFORE → AFTER (preserved)
- **BEFORE** (`audit-workspace/BEFORE-overlap/`): every region piled on top of the others — total
  overlap, no hierarchy. Text was large but collided. This is the honest failure evidence.
- **AFTER** (`audit-workspace/*.png`): bounded fix — smaller world-space type (T_TITLE 0.052 …
  T_SMALL 0.022), regions spread (header/left/center/right/bottom separated), long values truncated
  with an affordance (…), camera pulled to z=−7 fov 40 for margin, AutoBoot sphere removed.

## Verified in the AFTER captures (manual inspection)
| Criterion | Verdict |
|---|---|
| Graphically rendered, text readable at capture res | **PASS** |
| Current Focus is the obvious focal point ("Council Decision" large, centre) | **PASS** |
| First failure obvious (red `Verification: FIRST_FAILURE` + `◆ FIRST FAILURE`, centre) | **PASS** |
| Downstream distinct from first failure (rail `#3` red "FIRST" vs `#4` grey "dep") | **PASS** |
| Integrity ≠ correctness (Trust Strip: Integrity FIRST_FAILURE vs Decision Support NOT_EVALUATED) | **PASS** |
| Human review ≠ approval (separate rows: REQUIRES_HUMAN_REVIEW vs APPROVAL_NOT_PRESENT) | **PASS** |
| Source missing-state explicit (loc: LOCATION NOT AVAILABLE / resolution: NOT_PRESENT / OCR: NOT_EVALUATED) | **PASS** |
| Evidence rail readable (#1 #2 green, #3 red FIRST, #4 grey dep + actions) | **PASS** |
| Approval not shown as verification green (grey APPROVAL_NOT_PRESENT) | **PASS** |
| Chinese renders (no tofu): 银行审计 / 委员会决策 / 收入 | **PASS** |
| Trust posture SELF_SIGNED distinct (amber) | **PASS** |

## Honest residual defects (NOT a clean 100%)
1. **Top header** — the title's descenders still lightly touch the `tracking:` line. Minor; both readable.
2. **Left Source** — source name and the `loc:` line are vertically close (slight crowd). Readable.
3. **Right Trust Strip** — the 4th group ("Human / Policy Boundary" / "APPROVAL ABSENT") is close to
   the right edge and lightly clipped/abbreviated.
4. **Chinese localization is incomplete** — entity TITLES localize (委员会决策) but field LABELS
   (Verification / Human review / Approval …) still render in English in zh mode. CJK *rendering*
   passes; full zh *localization* of labels is a follow-up.

## Flags (honest)
- UNITY-WORKSPACE-GRAPHICALLY-RENDERED ✅
- AUDIT-WORKSPACE-CAPTURES-COMPLETE ✅ (7 states; not yet all 14 × 3 profiles)
- CURRENT-FOCUS-VISUALLY-READABLE ✅
- FIRST-FAILURE-VISUALLY-READABLE ✅
- DOWNSTREAM-VISUALLY-DISTINCT ✅
- REVIEW-APPROVAL-VISUALLY-DISTINCT ✅
- SOURCE-CARD-VISUALLY-READABLE ✅ (minor vertical crowd)
- TRUST-STRIP-VISUALLY-READABLE ✅ (minor right-edge crowd)
- EVIDENCE-RAIL-VISUALLY-READABLE ✅
- ENGLISH-RUNTIME-RENDERING-PASSED ✅ · CHINESE-RUNTIME-RENDERING-PASSED ✅ (glyphs; label localization partial)
- FLAT-COMPOSITION: **SUBSTANTIALLY-IMPROVED / PARTIAL** — regions distinct + hierarchy clear, but the 4
  residual crowd points above are not yet fully clean. Not claimed as a perfect pass.
- Kept false: all profiles beyond DesktopDark not yet captured; XrealOstBright/AccessibilityHighContrast
  captures + contact sheets pending; device flags false.
