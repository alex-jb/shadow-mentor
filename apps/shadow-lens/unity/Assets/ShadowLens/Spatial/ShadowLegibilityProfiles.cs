// apps/shadow-lens/unity/Assets/ShadowLens/Spatial/ShadowLegibilityProfiles.cs
// Editor preview profiles + legibility checks for the guided stage — so obvious problems
// (clipped text, controls outside the glasses safe zone, CaseCore/label intersections,
// undersized hit areas, excessive head turn) surface in the editor BEFORE Beam Pro arrives.
// Pure C#: no UnityEngine dependency in the math, so it is EditMode-testable and also
// host-checkable. Boxes are normalized (top-left origin, 0..1). This is NOT a substitute
// for on-device validation.
#if UNITY_2020_1_OR_NEWER
namespace ShadowLens.Spatial
{
    public readonly struct LegibilityBox
    {
        public readonly float x, y, w, h;   // normalized, top-left origin
        public LegibilityBox(float x, float y, float w, float h) { this.x = x; this.y = y; this.w = w; this.h = h; }
        public float Right => x + w;
        public float Bottom => y + h;
    }

    public readonly struct PreviewProfile
    {
        public readonly string name;
        public readonly int pxWidth, pxHeight;
        public readonly LegibilityBox safeZone;      // the region content must stay inside
        public readonly float passthroughComplexity; // 0 (blank) .. 1 (busy) — panel fill must stay readable
        public PreviewProfile(string name, int w, int h, LegibilityBox safe, float passthrough)
        { this.name = name; pxWidth = w; pxHeight = h; safeZone = safe; passthroughComplexity = passthrough; }
    }

    public static class ShadowLegibilityProfiles
    {
        // The five preview surfaces the stage must survive.
        public static readonly PreviewProfile[] Profiles = {
            new PreviewProfile("Desktop 16:9",              1920, 1080, new LegibilityBox(0.03f, 0.03f, 0.94f, 0.94f), 0.0f),
            new PreviewProfile("Narrow Landscape",          1280,  600, new LegibilityBox(0.05f, 0.05f, 0.90f, 0.90f), 0.0f),
            new PreviewProfile("Low-Resolution Landscape",   960,  540, new LegibilityBox(0.05f, 0.05f, 0.90f, 0.90f), 0.0f),
            // XREAL One Pro central safe zone is tighter than the full FOV (content should sit
            // near the middle so the wearer isn't forced to look to the edges).
            new PreviewProfile("Glasses Central Safe Zone", 1920, 1080, new LegibilityBox(0.15f, 0.15f, 0.70f, 0.70f), 0.0f),
            new PreviewProfile("High-Complexity Passthrough",1920, 1080, new LegibilityBox(0.10f, 0.10f, 0.80f, 0.80f), 0.9f),
        };

        // ── legibility checks (pure) ──
        public static bool IsClipped(LegibilityBox b, LegibilityBox safe) =>
            b.x < safe.x || b.y < safe.y || b.Right > safe.Right || b.Bottom > safe.Bottom;

        public static bool Overlaps(LegibilityBox a, LegibilityBox b) =>
            a.x < b.Right && b.x < a.Right && a.y < b.Bottom && b.y < a.Bottom;

        // A tap target below ~9% of width (≈ visionOS/Android XR minimum) is too small.
        public static bool IsUndersized(LegibilityBox b, float minFrac = 0.09f) => b.w < minFrac || b.h < minFrac;

        // Content requiring more than ~30° head yaw off-center forces excessive head movement.
        public static bool RequiresExcessiveHeadTurn(float contentYawDeg, float maxYawDeg = 30f) =>
            System.Math.Abs(contentYawDeg) > maxYawDeg;

        // On a busy passthrough background a panel must be sufficiently opaque to stay readable.
        public static bool PanelReadableOverPassthrough(float panelAlpha, float passthroughComplexity) =>
            panelAlpha >= 0.5f + 0.4f * passthroughComplexity;
    }
}
#endif
