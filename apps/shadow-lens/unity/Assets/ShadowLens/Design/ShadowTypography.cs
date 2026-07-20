// apps/shadow-lens/unity/Assets/ShadowLens/Design/ShadowTypography.cs
// Typographic scale. Headset-facing text SHOULD use TextMeshPro SDF for crisp edges at depth;
// the current mock uses legacy UI Text + the builtin font to avoid a TMP-essentials import
// step (swap to TMP is a drop-in once TMP is imported). Sizes are in canvas units.
// Authored for Unity 6; re-compile in Unity to apply.
#if UNITY_2020_1_OR_NEWER
namespace ShadowLens.Design
{
    public static class ShadowTypography
    {
        public const int Display = 42;   // product title
        public const int Title   = 30;   // panel titles
        public const int Heading = 24;   // decision posture
        public const int Body    = 22;   // primary readable body
        public const int Label   = 20;   // chips / buttons
        public const int Caption = 16;   // secondary metadata (source id, confidence)

        // XR wants larger minimums for comfortable reading distance.
        public static int Scale(int size, bool xr) => xr ? (int)System.Math.Round(size * 1.25) : size;
    }
}
#endif
