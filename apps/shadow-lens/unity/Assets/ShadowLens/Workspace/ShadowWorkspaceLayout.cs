// apps/shadow-lens/unity/Assets/ShadowLens/Workspace/ShadowWorkspaceLayout.cs
// THE single production definition of the Audit Workspace's world-space layout capacity.
// Before this existed the column origins, truncation budgets and row steps were inline literals in
// ShadowAuditWorkspace, and nothing related them to the width or line box of the text they had to
// hold — which is exactly how UX-02 (columns narrower than their content) and UX-03 (row step smaller
// than the rendered line box) happened. Production reads these values; the geometry tests read the
// SAME values, so a threshold can never drift apart from what is rendered.
//
// Units are world units in the workspace's local space. The capture camera sits at z −7.2 with a 40°
// vertical FOV at 1600×1000, which projects to 190.8 px per world unit and a visible x range of
// ±4.193 — those are recorded in ShadowWorkspaceLayout.CaptureRig for the tests to project with.
// They are an EDITOR_GEOMETRY_ESTIMATE, never a headset field of view.
#if UNITY_2020_1_OR_NEWER
using UnityEngine;

namespace ShadowLens.Workspace
{
    public static class ShadowWorkspaceLayout
    {
        // ── type scale (unchanged — UX-02/UX-03 are geometry defects, not typography) ──
        public const float TitleSize = 0.052f, HeadSize = 0.030f, LabelSize = 0.030f,
                           BodySize = 0.026f, SmallSize = 0.022f;

        // Both factors are MEASURED from real TextMesh renderer bounds in PlayMode, not estimated:
        //   one 0.026 line          → 0.1464 world units → 5.63 × charSize (6.20 keeps a margin)
        //   two 0.026 lines stacked → 0.3960 world units → the SECOND line advances 0.2496,
        //                             i.e. 9.60 × charSize — far more than one line box.
        // Stepping a wrapped block by lines × LineHeight is what left a 0.004-unit overlap; a block's
        // height must use the real multi-line advance.
        public const float LineBoxFactor = 6.20f;
        public const float MultiLineAdvanceFactor = 9.70f;
        public static float LineHeight(float charSize) => charSize * LineBoxFactor;
        public static float BlockHeight(float charSize, int lines) =>
            LineHeight(charSize) + Mathf.Max(0, lines - 1) * charSize * MultiLineAdvanceFactor;
        public static float BlockStep(float charSize, int lines) => BlockHeight(charSize, lines) + MinRowGap;

        // Horizontal advance per EM at a given character size, calibrated against the widest measured
        // string in the audited capture ("SOURCE NOT PRESENT": 8.92 em at 0.030 → 2.296 world units).
        // Deliberately conservative: over-estimating width shrinks a budget, it never overflows one.
        public const float EmAdvanceFactor = 8.60f;
        public static float EmToWorld(float em, float charSize) => em * charSize * EmAdvanceFactor;
        public static float WorldToEm(float world, float charSize) => world / (charSize * EmAdvanceFactor);

        // ── minimum gaps ──
        public const float MinColumnGap = 0.30f;   // between two columns' content boxes
        public const float MinRowGap = 0.035f;     // between two stacked line boxes
        public const float ViewportSafeX = 4.10f;  // inside the ±4.193 visible half-width

        // ── columns: origin x, and the width its content may occupy ──
        // Widths are the MEASURED requirement of the widest string each column must hold, plus the
        // named gap:  left 2.58 ("resolution: NOT PRESENT" = 11.5 em) · centre 3.18 ("Human review:
        // REQUIRES REVIEW" = 14.2 em) · right 1.84 ("Decision Support" = 8.10 em). Together with two
        // 0.30 gaps that is 8.20 — exactly the ±4.10 safe width, which is why the left column moved
        // out into the previously unused margin.
        // Left moved out into the unused left margin and widened; centre and right keep their place so
        // the accepted composition and the camera are untouched. Borrowing that margin is the
        // horizontal counterpart of the unused capacity recorded as UX-08 — UX-08 itself stays open.
        public const float LeftX = -4.10f, LeftWidth = 2.58f;
        public const float CenterX = -1.22f, CenterWidth = 3.18f;
        public const float RightX = 2.26f, RightWidth = 1.84f;
        public const float TopX = -4.10f, TopY = 2.05f, TopWidth = 3.90f;
        public const float ColumnY = 1.10f;
        public const float BottomX = -2.40f, BottomY = -1.98f;   // clears the taller centre column with a real gap, still inside the safe bottom

        // ── row rhythm, derived from the line box rather than guessed ──
        public static float BodyRowStep => LineHeight(BodySize) + MinRowGap;        // ≈ 0.196
        public static float LabelRowStep => LineHeight(LabelSize) + MinRowGap;      // ≈ 0.221
        public static float TrustPairStep => LineHeight(BodySize) + MinRowGap;      // label → its value
        public static float TrustGroupStep => TrustPairStep + LineHeight(BodySize) + MinRowGap * 2f;
        public static float TitleToNextStep => LineHeight(TitleSize) + MinRowGap;   // ≈ 0.358

        // ── truncation budgets, derived from the column each string lives in ──
        public static float LeftLabelEm => WorldToEm(LeftWidth, LabelSize);   // ≈ 10.5
        public static float LeftBodyEm => WorldToEm(LeftWidth, BodySize);     // ≈ 12.1
        public static float CenterTitleEm => WorldToEm(CenterWidth, TitleSize);
        public static float CenterBodyEm => WorldToEm(CenterWidth, BodySize); // ≈ 13.9
        public static float RightBodyEm => WorldToEm(RightWidth, BodySize);   // ≈ 8.0
        public static float TopTitleEm => WorldToEm(TopWidth, TitleSize);

        // ── evidence guide / rail (UX-14) ───────────────────────────────────────────────────
        // The bottom rail stacked four things in ~0.16-unit steps while their line boxes are
        // 0.14-0.25 tall, so the top label ("FIRST"/"↓dep") touched its node and the action legend
        // ran under the "#n" index. The stack is re-derived from the real line boxes so every row
        // clears the next, and lifted into the empty band above the rail (the UX-08 space) so it does
        // not touch the viewport bottom OR the centre column. The region origin (BottomX, BottomY
        // = -1.98) is unchanged; only the local layout inside it moves.
        public const float RailStepSpacing = 0.62f;          // horizontal step pitch (measured safe)
        public const float RailLabelInsetX = -0.05f;         // labels sit just left of the node centre
        public const float RailNodeCurrentScale = 0.15f, RailNodeOtherScale = 0.09f;
        public const float RailSeqCurrentSize = 0.040f, RailSeqOtherSize = 0.028f;
        public const float RailTopLabelSize = SmallSize;     // FIRST / ↓dep
        public const float RailActionSize = SmallSize;       // ◀ Prev ▶ Next … legend
        // vertical stack, top → bottom, each row separated by its own line box + MinRowGap:
        public const float RailTopLabelY = 0.42f;
        public static float RailNodeCenterY => RailTopLabelY - LineHeight(RailTopLabelSize) - MinRowGap - RailNodeCurrentScale * 0.5f;
        public static float RailSeqY => RailNodeCenterY - RailNodeCurrentScale * 0.5f - MinRowGap;
        public static float RailActionY => RailSeqY - LineHeight(RailSeqCurrentSize) - MinRowGap;
        public static float RailBottomExtent => RailActionY - LineHeight(RailActionSize); // for the containment test

        // ── audit-result hierarchy (UX-07) ──────────────────────────────────────────────────
        // The failure conclusion was the FOURTH-largest thing on screen: "FIRST FAILURE" rendered at
        // 0.030 while two unrelated titles rendered at 0.052, so the eye landed on the story name.
        // Hierarchy is expressed as named presentation roles and applied ONLY while the focused entity
        // is the first failure; every supporting element stays visible and keeps its wording, colour
        // family and position.
        //
        // Three independent signals carry it — never colour alone, never motion, never hiding:
        //   1. TYPOGRAPHY  the conclusion is the largest element, and the two titles step down to
        //                  ContextTitleSize while a failure is on screen.
        //   2. RULE        a short accent bar under the conclusion (surface/border emphasis).
        //   3. PADDING     extra local space above and below, separating it from the field rows.
        public enum PresentationRole { PrimaryAuditConclusion, SecondaryAuditContext, SupportingEvidence, SystemContext }

        // 0.046 is the largest size at which "◆ FIRST FAILURE" (7.36 em) still fits CenterWidth
        // without wrapping or truncating: 7.36 × 0.046 × 8.60 = 2.91 ≤ 3.18.
        public const float ConclusionSize = 0.046f;
        // Titles step down only while a failure is the conclusion. At 0.040 "Council Decision"
        // (8.62 em → 2.97) also stops wrapping, so the centre column gets SHORTER, not taller.
        public const float ContextTitleSize = 0.040f;
        public const float ConclusionPadAbove = 0.055f, ConclusionPadBelow = 0.045f;
        public const float ConclusionRuleHeight = 0.014f;   // accent bar thickness
        public const float ConclusionRuleWidth = 1.05f;     // shorter than the text it underlines
        public const float ConclusionRuleGap = 0.020f;      // between the text box and its rule

        /// <summary>Title size for the current audit state — steps down while a first failure is the conclusion.</summary>
        public static float TitleSizeFor(bool firstFailureIsConclusion) => firstFailureIsConclusion ? ContextTitleSize : TitleSize;
        /// <summary>Truncation budget for the conclusion line at its own size.</summary>
        public static float ConclusionEm => WorldToEm(CenterWidth, ConclusionSize);
        /// <summary>Named ratio the conclusion must clear against the largest competing label.</summary>
        public const float MinConclusionDominanceRatio = 1.12f;

        // ── degraded-tracking banner (UX-04) ────────────────────────────────────────────────
        // The banner sat at top+x 2.90 with UpperLeft anchoring and NO width bound, so
        // "TRACKING LOST — switched to session-relative layout; audit state preserved" (34.8 em ≈ 7.78
        // world units) ran straight off the right edge. It now has an explicit bounded region:
        //   · starts one MinColumnGap right of the header title's own width, so a long story title and
        //     the banner can never share x,
        //   · ends at the viewport-safe edge,
        //   · wraps deterministically inside that width to at most BannerMaxLines,
        //   · sits high enough that the tallest wrap still clears the column tops.
        // Anchor stays UpperLeft: every other label in the workspace reads left-aligned, and a bounded
        // width plus wrapping removes the clipping without inverting the reading rhythm.
        public const float BannerLocalX = TopWidth + MinColumnGap;      // local to the top region
        public const float BannerLocalY = 0.06f;                        // clears the column tops when wrapped
        public const int BannerMaxLines = 3;                            // SCANNING already ships 3 lines
        public static float BannerWorldX => TopX + BannerLocalX;
        public static float BannerWidth => ViewportSafeX - BannerWorldX;
        public static float BannerEm => WorldToEm(BannerWidth, BodySize);
        public static float BannerTopY => TopY + BannerLocalY;
        public static float BannerBottomBound => ColumnY + MinRowGap;   // must not reach the columns
        public static float BannerMaxHeight => BannerTopY - BannerBottomBound;

        // The capture rig the geometry tests project through. EDITOR_GEOMETRY_ESTIMATE — not a headset.
        public static class CaptureRig
        {
            public const int PixelWidth = 1600, PixelHeight = 1000;
            public const float CameraZ = -7.2f, CameraY = 0.1f, FieldOfViewDeg = 40f;
            public const float Distance = 7.2f;
        }
    }
}
#endif
