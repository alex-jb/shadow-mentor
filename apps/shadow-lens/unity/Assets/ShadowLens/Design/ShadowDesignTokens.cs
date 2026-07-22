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

        // ── V11: visual profiles ─────────────────────────────────────────────────────────────────
        // The static fields above ARE the DesktopDark palette (unchanged — existing call sites keep
        // their exact behavior). Resolve(profile) returns a per-surface token set WITHOUT rewriting the
        // status system: status VALUES + shapes live in ShadowGuidedStoryStatus; here only the *rendered
        // colour* is contrast-tuned per surface, and StatusColorFor() keeps the identical semantic switch.
        public enum ShadowVisualProfile
        {
            DesktopDark,               // Unity Game view / desktop dark (default)
            BrowserDark,               // web verifier surface — same dark palette, distinct id
            XrealOstBright,            // optical see-through: bright opaque panels, dark text, bold outlines
            ProjectorPresentation,     // bright-room projection: max contrast, fully opaque
            AccessibilityHighContrast, // pure black/white + max-chroma status
        }

        // A resolved, surface-specific token set. `BrightForeground` true means "light panels + dark text —
        // do NOT rely on black backgrounds or shadows" (the OST requirement). `PanelAlpha` is panel
        // occlusion strength; `BorderWidthScale` drives outline thickness (bold outlines on OST).
        public struct ShadowThemeTokens
        {
            public ShadowVisualProfile Profile;
            public bool BrightForeground;
            public float PanelAlpha;
            public float BorderWidthScale;
            public Color Background, PanelPrimary, PanelSecondary, Border;
            public Color TextPrimary, TextSecondary;
            public Color Verified, Warning, Tampered, Information, Neutral;

            public Color PanelFill() => new Color(PanelPrimary.r, PanelPrimary.g, PanelPrimary.b, PanelAlpha);

            // Identical semantic mapping to StatusColor(string) — same buckets, profile-tuned colour only.
            public Color StatusColorFor(string status)
            {
                switch ((status ?? "").ToLowerInvariant())
                {
                    case "verified": case "approved": case "complete": return Verified;
                    case "failed": case "tampered": case "rejected": return Tampered;
                    case "partial": case "incomplete": case "pending": case "warning": return Warning;
                    case "info": return Information;
                    default: return Neutral;
                }
            }
        }

        public static ShadowThemeTokens Resolve(ShadowVisualProfile profile)
        {
            switch (profile)
            {
                case ShadowVisualProfile.XrealOstBright:
                    // See-through additive display: black = invisible, so panels are BRIGHT + near-opaque
                    // and text is DARK for contrast against unpredictable real-world backgrounds. Bold
                    // outlines, high panel alpha, minimal translucency. Status hues preserved but darkened
                    // to stay legible on a bright panel.
                    return new ShadowThemeTokens {
                        Profile = profile, BrightForeground = true, PanelAlpha = 0.94f, BorderWidthScale = 2f,
                        Background     = Hex("F4F6F8"),
                        PanelPrimary   = Hex("FBFCFD"),
                        PanelSecondary = Hex("E7ECEF"),
                        Border         = new Color(0.05f, 0.08f, 0.11f, 0.88f), // bold dark outline
                        TextPrimary    = Hex("0E141A"),
                        TextSecondary  = Hex("3A4650"),
                        Verified   = Hex("0B7A52"),
                        Warning    = Hex("9A6400"),
                        Tampered   = Hex("C1272D"),
                        Information = Hex("1560B8"),
                        Neutral    = Hex("5A6570"),
                    };
                case ShadowVisualProfile.ProjectorPresentation:
                    // Bright room, opaque plates, max contrast — dark palette but fully opaque, bold border.
                    return new ShadowThemeTokens {
                        Profile = profile, BrightForeground = false, PanelAlpha = 1f, BorderWidthScale = 1.5f,
                        Background = Hex("05080B"), PanelPrimary = Hex("0E141B"), PanelSecondary = Hex("161F29"),
                        Border = new Color(1f, 1f, 1f, 0.24f),
                        TextPrimary = Hex("FFFFFF"), TextSecondary = Hex("C4CDD6"),
                        Verified = Hex("34E0A6"), Warning = Hex("FFD166"), Tampered = Hex("FF6B78"),
                        Information = Hex("6FB4FF"), Neutral = Hex("AEB8C2"),
                    };
                case ShadowVisualProfile.AccessibilityHighContrast:
                    return new ShadowThemeTokens {
                        Profile = profile, BrightForeground = false, PanelAlpha = 1f, BorderWidthScale = 2f,
                        Background = Hex("000000"), PanelPrimary = Hex("000000"), PanelSecondary = Hex("0A0A0A"),
                        Border = new Color(1f, 1f, 1f, 1f),
                        TextPrimary = Hex("FFFFFF"), TextSecondary = Hex("E6E6E6"),
                        Verified = Hex("00E676"), Warning = Hex("FFD600"), Tampered = Hex("FF1744"),
                        Information = Hex("40C4FF"), Neutral = Hex("BDBDBD"),
                    };
                default: // DesktopDark + BrowserDark — the legacy static palette, unchanged
                    return new ShadowThemeTokens {
                        Profile = profile, BrightForeground = false, PanelAlpha = 0.86f, BorderWidthScale = 1f,
                        Background = Background, PanelPrimary = PanelPrimary, PanelSecondary = PanelSecondary,
                        Border = Border, TextPrimary = TextPrimary, TextSecondary = TextSecondary,
                        Verified = Verified, Warning = Warning, Tampered = Tampered,
                        Information = Information, Neutral = Neutral,
                    };
            }
        }
    }
}
#endif
