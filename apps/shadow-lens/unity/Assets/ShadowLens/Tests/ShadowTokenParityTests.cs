// apps/shadow-lens/unity/Assets/ShadowLens/Tests/ShadowTokenParityTests.cs
// Unity side of the cross-surface semantic-token parity (V11). The canonical source
// (design/shadow-spatial-tokens.json) fixes the PERMANENT colour meanings; each surface may use its own
// exact shade, but the SEMANTIC HUE must match: verification=green, failure=red, warning/scanning=amber,
// selection/information=blue, not-evaluated=neutral. These tests assert Unity's ShadowDesignTokens obey
// those meanings across every visual profile — so green never drifts onto a non-verification concept.
// AUTHORED — run in Unity 6.
#if UNITY_INCLUDE_TESTS
using NUnit.Framework;
using UnityEngine;
using ShadowLens.Design;
using P = ShadowLens.Design.ShadowDesignTokens.ShadowVisualProfile;

namespace ShadowLens.Tests
{
    public class ShadowTokenParityTests
    {
        [TearDown] public void Reset() { ShadowDesignTokens.ActiveProfile = P.DesktopDark; }

        static bool IsGreen(Color c) => c.g > 0.45f && c.g > c.r + 0.1f && c.g > c.b + 0.1f;
        static bool IsRed(Color c)   => c.r > 0.55f && c.r > c.g + 0.2f && c.r > c.b + 0.1f;
        static bool IsAmber(Color c) => c.r > 0.5f && c.g > 0.35f && c.b < c.g - 0.1f && c.b < 0.55f;
        static bool IsBlue(Color c)  => c.b > 0.5f && c.b > c.r + 0.05f;

        [Test] public void SemanticHues_HoldAcrossEveryProfile()
        {
            foreach (P p in System.Enum.GetValues(typeof(P)))
            {
                var t = ShadowDesignTokens.Resolve(p);
                Assert.IsTrue(IsGreen(t.Verified), $"{p}: Verified must be GREEN (verification) — {t.Verified}");
                Assert.IsTrue(IsRed(t.Tampered),   $"{p}: Tampered must be RED (failure) — {t.Tampered}");
                Assert.IsTrue(IsAmber(t.Warning),  $"{p}: Warning must be AMBER (caution) — {t.Warning}");
                Assert.IsTrue(IsBlue(t.Information),$"{p}: Information must be BLUE (info/selection) — {t.Information}");
            }
        }

        [Test] public void VerificationGreen_NotReusedForNonVerification()
        {
            foreach (P p in System.Enum.GetValues(typeof(P)))
            {
                var t = ShadowDesignTokens.Resolve(p);
                // Warning / Tampered / Neutral / Information must NOT be green — green is reserved for Verified.
                Assert.IsFalse(IsGreen(t.Tampered),    $"{p}: Tampered must not be green");
                Assert.IsFalse(IsGreen(t.Warning),     $"{p}: Warning must not be green");
                Assert.IsFalse(IsGreen(t.Neutral),     $"{p}: Neutral must not be green");
                Assert.IsFalse(IsGreen(t.Information),  $"{p}: Information must not be green");
            }
        }

        [Test] public void GuidedStoryStatus_ColourKey_MatchesVerificationFamily()
        {
            // ShadowGuidedStoryStatus.ColorKeyOf maps status → a token key; verified→verified (green family),
            // failed/tampered→tampered (red). Confirm the mapping keys are the canonical ones.
            var S = typeof(ShadowLens.GuidedStory.ShadowGuidedStoryStatus);
            Assert.AreEqual("verified", ShadowLens.GuidedStory.ShadowGuidedStoryStatus.ColorKeyOf("VERIFIED"));
            // verified (pass/green) and a failure must map to DISTINCT colour keys — never both green.
            Assert.AreNotEqual(ShadowLens.GuidedStory.ShadowGuidedStoryStatus.ColorKeyOf("VERIFIED"),
                               ShadowLens.GuidedStory.ShadowGuidedStoryStatus.ColorKeyOf("FAILED"),
                               "verified and failed must not share a colour key");
        }
    }
}
#endif
