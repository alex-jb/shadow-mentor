// apps/shadow-lens/unity/Assets/ShadowLens/Design/ShadowSpacing.cs
// Spacing scale + workspace proportions. The default document workspace sits ~1.5–2 m in front
// of the viewer: Document Slate ~42% width (left), Decision Card ~34% (right), a compact Trust
// Bar on top, a horizontal Action Rail on the bottom. Authored for Unity 6.
#if UNITY_2020_1_OR_NEWER
namespace ShadowLens.Design
{
    public static class ShadowSpacing
    {
        public const float X1 = 8f, X2 = 16f, X3 = 24f, X4 = 32f, X6 = 48f, X8 = 64f;
        public const float PanelRadius = 10f;
        public const float BorderWidth = 2f;

        // workspace proportions of the primary width
        public const float DocumentSlateFrac = 0.42f;
        public const float DecisionCardFrac  = 0.34f;
        public const float GutterFrac        = 0.06f;

        // world workspace placement (metres)
        public const float WorkspaceDistance = 1.7f;   // in front of the viewer
        public const float WorkspaceWidth    = 1.6f;   // total metres wide
        public const float WorkspaceHeight   = 0.9f;
    }
}
#endif
