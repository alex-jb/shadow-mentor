// apps/shadow-lens/unity/Assets/ShadowLens/Tests/ShadowGuidedStoryOstTests.cs
// EditMode tests for the guided-story surface CONSUMING XREAL_OST_BRIGHT (V11 deep-audit + OST review: the
// player rendered white labels on a transparent backdrop that vanished on bright OST backgrounds). The
// player now switches to dark text on a bright backplate when that profile is active. Tests the decision +
// the token contrast without instantiating the MonoBehaviour. AUTHORED — run in Unity 6.
#if UNITY_INCLUDE_TESTS
using NUnit.Framework;
using UnityEngine;
using ShadowLens.Design;
using ShadowLens.GuidedStory;
using P = ShadowLens.Design.ShadowDesignTokens.ShadowVisualProfile;

namespace ShadowLens.Tests
{
    public class ShadowGuidedStoryOstTests
    {
        static float Lum(Color c) => 0.299f * c.r + 0.587f * c.g + 0.114f * c.b;

        [TearDown] public void Reset() { ShadowDesignTokens.ActiveProfile = P.DesktopDark; }

        [Test] public void BrightBackplate_OnlyWhenOstBrightProfileActive()
        {
            ShadowDesignTokens.ActiveProfile = P.DesktopDark;
            Assert.IsFalse(ShadowGuidedStoryPlayer.BrightBackplateActive(), "no backplate on desktop dark (white text on transparent, as before)");

            ShadowDesignTokens.ActiveProfile = P.XrealOstBright;
            Assert.IsTrue(ShadowGuidedStoryPlayer.BrightBackplateActive(), "OST bright must switch on the readable dark-on-bright treatment");

            ShadowDesignTokens.ActiveProfile = P.ProjectorPresentation;
            Assert.IsFalse(ShadowGuidedStoryPlayer.BrightBackplateActive(), "only XREAL_OST_BRIGHT triggers the see-through backplate");
        }

        [Test] public void OstProfile_GivesDarkTextOnBrightPlate()
        {
            var t = ShadowDesignTokens.Resolve(P.XrealOstBright);
            Assert.Greater(Lum(t.PanelPrimary), 0.85f, "the label backplate colour must be bright (occludes the see-through world)");
            Assert.Less(Lum(t.TextPrimary), 0.25f, "OST label text must be dark for contrast on the bright plate");
            Assert.Greater(Lum(t.PanelPrimary) - Lum(t.TextPrimary), 0.6f, "dark-on-bright must clear a high contrast bar");
        }
    }
}
#endif
