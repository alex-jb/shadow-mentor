// apps/shadow-lens/unity/Assets/ShadowLens/Design/ShadowDesignTokens.cs
// "Shadow Institutional Spatial UI" — centralized semantic color tokens. Banking-grade, calm,
// precise; not cyberpunk, not game-like. Colors are SEMANTIC only (no decorative per-reviewer
// colors). Readable in XREAL/Quest and desktop Game view.
// STATUS: authored for the Unity 6 project; re-compile in Unity to apply. No device validation.
#if UNITY_2020_1_OR_NEWER
using UnityEngine;

namespace ShadowLens.Design
{
    public static class ShadowDesignTokens
    {
        static Color Hex(string h, float a = 1f)
        {
            h = h.TrimStart('#');
            byte r = (byte)System.Convert.ToInt32(h.Substring(0, 2), 16);
            byte g = (byte)System.Convert.ToInt32(h.Substring(2, 2), 16);
            byte b = (byte)System.Convert.ToInt32(h.Substring(4, 2), 16);
            return new Color32(r, g, b, (byte)Mathf.RoundToInt(a * 255));
        }

        // surfaces
        public static readonly Color Background     = Hex("090D12");
        public static readonly Color PanelPrimary   = Hex("111820");
        public static readonly Color PanelSecondary = Hex("18212B");
        public static readonly Color Border         = new Color(1f, 1f, 1f, 0.10f); // white @ 10%

        // text
        public static readonly Color TextPrimary    = Hex("F2F5F7");
        public static readonly Color TextSecondary  = Hex("9DA9B5");

        // semantic states
        public static readonly Color Verified   = Hex("2FD19A");
        public static readonly Color Warning    = Hex("F2C14E");
        public static readonly Color Tampered   = Hex("FF5F6D");
        public static readonly Color Information = Hex("5CA8FF");
        public static readonly Color Neutral    = Hex("9DA9B5"); // unavailable / not tested

        // Panel materials must stay readable over changing passthrough backgrounds → controlled opacity.
        public static Color PanelFill(bool passthrough) => passthrough ? new Color(PanelPrimary.r, PanelPrimary.g, PanelPrimary.b, 0.86f) : PanelPrimary;
        public static Color PanelFillSecondary(bool passthrough) => passthrough ? new Color(PanelSecondary.r, PanelSecondary.g, PanelSecondary.b, 0.82f) : PanelSecondary;

        // Map a trust/status value to its semantic color. Record integrity is the ONLY use of
        // Verified green; incomplete coverage/review is Warning; real tamper is Tampered red.
        public static Color StatusColor(string status)
        {
            switch ((status ?? "").ToLowerInvariant())
            {
                case "verified": case "approved": case "complete": return Verified;
                case "failed": case "tampered": case "rejected": return Tampered;
                case "partial": case "incomplete": case "pending": case "warning": return Warning;
                case "info": return Information;
                default: return Neutral; // unavailable / not tested
            }
        }
    }
}
#endif
