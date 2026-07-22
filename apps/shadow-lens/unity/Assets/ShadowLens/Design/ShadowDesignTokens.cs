// apps/shadow-lens/unity/Assets/ShadowLens/Design/ShadowDesignTokens.cs
// "Shadow Institutional Spatial UI" — centralized semantic color tokens. Banking-grade, calm,
// precise; not cyberpunk, not game-like. Colors are SEMANTIC only (no decorative per-reviewer
// colors). Readable in XREAL/Quest and desktop Game view.
// STATUS: authored for the Unity 6 project; re-compile in Unity to apply. No device validation.
//
// V11: the color accessors below now read the ACTIVE visual profile (default DesktopDark, byte-identical
// to the historical palette). Set ShadowDesignTokens.ActiveProfile = XrealOstBright to switch the WHOLE
// UI to the bright optical-see-through theme (every existing call site follows automatically). The status
// system is NOT changed — StatusColor keeps the identical semantic switch; only the rendered colour is
// profile-tuned. Status VALUES + shapes live in ShadowGuidedStoryStatus.
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

        // ── active profile (default DesktopDark = the legacy palette; cached) ──────────────────────
        static ShadowVisualProfile _active = ShadowVisualProfile.DesktopDark;
        static ShadowThemeTokens _cache;
        static bool _cached;
        public static ShadowVisualProfile ActiveProfile
        {
            get => _active;
            set { _active = value; _cache = Resolve(value); _cached = true; }
        }
        static ShadowThemeTokens Active
        {
            get { if (!_cached) { _cache = Resolve(_active); _cached = true; } return _cache; }
        }

        // surfaces — profile-resolved (DesktopDark returns the exact historical values)
        public static Color Background     => Active.Background;
        public static Color PanelPrimary   => Active.PanelPrimary;
        public static Color PanelSecondary => Active.PanelSecondary;
        public static Color Border         => Active.Border;

        // text
        public static Color TextPrimary    => Active.TextPrimary;
        public static Color TextSecondary  => Active.TextSecondary;

        // semantic states
        public static Color Verified    => Active.Verified;
        public static Color Warning     => Active.Warning;
        public static Color Tampered    => Active.Tampered;
        public static Color Information => Active.Information;
        public static Color Neutral     => Active.Neutral;

        // Panel materials must stay readable over changing passthrough backgrounds → controlled opacity.
        public static Color PanelFill(bool passthrough) => passthrough ? new Color(Active.PanelPrimary.r, Active.PanelPrimary.g, Active.PanelPrimary.b, Active.PanelAlpha) : Active.PanelPrimary;
        public static Color PanelFillSecondary(bool passthrough) => passthrough ? new Color(Active.PanelSecondary.r, Active.PanelSecondary.g, Active.PanelSecondary.b, Active.PanelAlpha) : Active.PanelSecondary;

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
        // Resolve(profile) returns a per-surface token set. The DesktopDark case is the single source of
        // the historical palette (literals — NOT the properties above, which read back through Active).
        public enum ShadowVisualProfile
        {
            DesktopDark,               // Unity Game view / desktop dark (default)
            BrowserDark,               // web verifier surface — same dark palette, distinct id
            XrealOstBright,            // optical see-through: bright opaque panels, dark text, bold outlines
            ProjectorPresentation,     // bright-room projection: max contrast, fully opaque
            AccessibilityHighContrast, // pure black/white + max-chroma status
        }

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
                    // and text is DARK for contrast against unpredictable real backgrounds. Bold dark
                    // outlines, high panel alpha, minimal translucency. Status hues preserved but darkened
                    // to stay legible on a bright panel.
                    return new ShadowThemeTokens {
                        Profile = profile, BrightForeground = true, PanelAlpha = 0.94f, BorderWidthScale = 2f,
                        Background     = Hex("F4F6F8"),
                        PanelPrimary   = Hex("FBFCFD"),
                        PanelSecondary = Hex("E7ECEF"),
                        Border         = new Color(0.05f, 0.08f, 0.11f, 0.88f),
                        TextPrimary    = Hex("0E141A"),
                        TextSecondary  = Hex("3A4650"),
                        Verified   = Hex("0B7A52"),
                        Warning    = Hex("9A6400"),
                        Tampered   = Hex("C1272D"),
                        Information = Hex("1560B8"),
                        Neutral    = Hex("5A6570"),
                    };
                case ShadowVisualProfile.ProjectorPresentation:
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
                default: // DesktopDark + BrowserDark — the historical palette (literal source of truth)
                    return new ShadowThemeTokens {
                        Profile = profile, BrightForeground = false, PanelAlpha = 0.86f, BorderWidthScale = 1f,
                        Background = Hex("090D12"), PanelPrimary = Hex("111820"), PanelSecondary = Hex("18212B"),
                        Border = new Color(1f, 1f, 1f, 0.10f),
                        TextPrimary = Hex("F2F5F7"), TextSecondary = Hex("9DA9B5"),
                        Verified = Hex("2FD19A"), Warning = Hex("F2C14E"), Tampered = Hex("FF5F6D"),
                        Information = Hex("5CA8FF"), Neutral = Hex("9DA9B5"),
                    };
            }
        }
    }
}
#endif
