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
