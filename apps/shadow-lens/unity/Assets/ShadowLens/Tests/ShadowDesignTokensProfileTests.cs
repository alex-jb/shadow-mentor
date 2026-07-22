// apps/shadow-lens/unity/Assets/ShadowLens/Tests/ShadowDesignTokensProfileTests.cs
// EditMode tests for the V11 visual profiles. Pins: (1) DesktopDark is byte-identical to the legacy static
// palette (back-compat — existing call sites unchanged); (2) XREAL_OST_BRIGHT is a genuine bright/OST theme
// (bright panels, dark text, bold outlines, high occlusion, minimal translucency); (3) the status system is
// NOT rewritten — StatusColorFor keeps the identical semantic buckets. AUTHORED — run in Unity 6.
#if UNITY_INCLUDE_TESTS
using NUnit.Framework;
using UnityEngine;
using ShadowLens.Design;
using P = ShadowLens.Design.ShadowDesignTokens.ShadowVisualProfile;

namespace ShadowLens.Tests
{
    public class ShadowDesignTokensProfileTests
    {
        // perceived luminance (Rec. 601) — used to assert "bright panel" / "dark text"
        static float Lum(Color c) => 0.299f * c.r + 0.587f * c.g + 0.114f * c.b;

        [Test] public void AllFiveProfilesResolve()
        {
            foreach (P p in System.Enum.GetValues(typeof(P)))
            {
                var t = ShadowDesignTokens.Resolve(p);
                Assert.AreEqual(p, t.Profile);
            }
            Assert.AreEqual(5, System.Enum.GetValues(typeof(P)).Length, "five profiles: desktop/browser dark, OST bright, projector, a11y");
        }

        [Test] public void DesktopDark_IsByteIdenticalToLegacyStaticPalette()
        {
            var t = ShadowDesignTokens.Resolve(P.DesktopDark);
            Assert.AreEqual(ShadowDesignTokens.Background, t.Background);
            Assert.AreEqual(ShadowDesignTokens.PanelPrimary, t.PanelPrimary);
            Assert.AreEqual(ShadowDesignTokens.TextPrimary, t.TextPrimary);
            Assert.AreEqual(ShadowDesignTokens.Verified, t.Verified);
            Assert.AreEqual(ShadowDesignTokens.Tampered, t.Tampered);
            Assert.IsFalse(t.BrightForeground, "desktop dark must not be a bright-foreground profile");
        }

        [Test] public void XrealOstBright_IsBrightForegroundWithDarkText()
        {
            var t = ShadowDesignTokens.Resolve(P.XrealOstBright);
            Assert.IsTrue(t.BrightForeground, "OST profile must be bright-foreground (no reliance on black)");
            Assert.Greater(Lum(t.PanelPrimary), 0.85f, "OST panel must be bright (occludes the see-through world)");
            Assert.Less(Lum(t.TextPrimary), 0.25f, "OST primary text must be dark for contrast on a bright panel");
            Assert.Greater(Lum(t.PanelPrimary) - Lum(t.TextPrimary), 0.6f, "OST needs high text/panel contrast");
        }

        [Test] public void XrealOstBright_HasHighOcclusionAndBoldOutlines()
        {
            var t = ShadowDesignTokens.Resolve(P.XrealOstBright);
            Assert.GreaterOrEqual(t.PanelAlpha, 0.9f, "OST panels must be near-opaque (minimal translucency)");
            Assert.GreaterOrEqual(t.BorderWidthScale, 2f, "OST needs bold/clear outlines");
            Assert.Greater(t.Border.a, 0.7f, "OST border must be strong, not a faint 10% white line");
            // dark bold border, not the dark-theme faint-white border
            Assert.Less(Lum(new Color(t.Border.r, t.Border.g, t.Border.b)), 0.3f, "OST outline is a bold DARK edge");
        }

        [Test] public void StatusSystem_NotRewritten_SemanticBucketsPreservedAcrossProfiles()
        {
            foreach (P p in System.Enum.GetValues(typeof(P)))
            {
                var t = ShadowDesignTokens.Resolve(p);
                // identical semantic mapping to the legacy StatusColor(string) switch
                Assert.AreEqual(t.Verified,   t.StatusColorFor("verified"));
                Assert.AreEqual(t.Verified,   t.StatusColorFor("approved"));
                Assert.AreEqual(t.Tampered,   t.StatusColorFor("failed"));
                Assert.AreEqual(t.Tampered,   t.StatusColorFor("tampered"));
                Assert.AreEqual(t.Warning,    t.StatusColorFor("partial"));
                Assert.AreEqual(t.Information, t.StatusColorFor("info"));
                Assert.AreEqual(t.Neutral,    t.StatusColorFor("something-unknown"));
                // the four semantic states must be visually distinct within every profile
                Assert.AreNotEqual(t.Verified, t.Tampered);
                Assert.AreNotEqual(t.Warning, t.Information);
                Assert.AreNotEqual(t.Verified, t.Warning);
            }
        }

        [Test] public void PanelFill_AppliesProfileAlpha()
        {
            var ost = ShadowDesignTokens.Resolve(P.XrealOstBright);
            Assert.AreEqual(ost.PanelAlpha, ost.PanelFill().a, 1e-4f);
            var proj = ShadowDesignTokens.Resolve(P.ProjectorPresentation);
            Assert.AreEqual(1f, proj.PanelFill().a, 1e-4f, "projector plates fully opaque");
        }
    }
}
#endif
