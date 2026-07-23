# Audit Workspace — graphical acceptance

**Status: GRAPHICALLY RENDERED + core readability PASS after a bounded layout correction. Composition
is SUBSTANTIALLY IMPROVED with minor residual crowding. NOT device validated.**

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
