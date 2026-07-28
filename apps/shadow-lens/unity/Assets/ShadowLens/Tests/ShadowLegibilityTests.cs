// apps/shadow-lens/unity/Assets/ShadowLens/Tests/ShadowLegibilityTests.cs
// EditMode tests for the legibility profiles + checks (pure math). AUTHORED — run in Unity 6.
#if UNITY_INCLUDE_TESTS
using NUnit.Framework;
using ShadowLens.Spatial;

namespace ShadowLens.Tests
{
    public class ShadowLegibilityTests
    {
        [Test] public void FivePreviewProfiles_IncludingGlassesSafeZone()
        {
            Assert.AreEqual(5, ShadowLegibilityProfiles.Profiles.Length);
            bool hasSafe = false, hasPassthrough = false;
            foreach (var p in ShadowLegibilityProfiles.Profiles)
            {
                if (p.name.Contains("Safe Zone")) hasSafe = true;
                if (p.name.Contains("Passthrough")) hasPassthrough = true;
            }
            Assert.IsTrue(hasSafe, "must include the glasses central safe zone");
            Assert.IsTrue(hasPassthrough, "must include a high-complexity passthrough profile");
        }

        [Test] public void ClippedText_DetectedAgainstSafeZone()
        {
            var safe = new LegibilityBox(0.15f, 0.15f, 0.70f, 0.70f);
            Assert.IsTrue(ShadowLegibilityProfiles.IsClipped(new LegibilityBox(0.02f, 0.5f, 0.2f, 0.1f), safe), "left edge outside safe zone is clipped");
            Assert.IsFalse(ShadowLegibilityProfiles.IsClipped(new LegibilityBox(0.4f, 0.4f, 0.2f, 0.1f), safe), "centered content is not clipped");
        }

        [Test] public void Overlap_And_Undersize_Detected()
        {
            Assert.IsTrue(ShadowLegibilityProfiles.Overlaps(new LegibilityBox(0.1f, 0.1f, 0.3f, 0.3f), new LegibilityBox(0.2f, 0.2f, 0.3f, 0.3f)));
            Assert.IsFalse(ShadowLegibilityProfiles.Overlaps(new LegibilityBox(0.1f, 0.1f, 0.1f, 0.1f), new LegibilityBox(0.5f, 0.5f, 0.1f, 0.1f)));
            Assert.IsTrue(ShadowLegibilityProfiles.IsUndersized(new LegibilityBox(0, 0, 0.05f, 0.2f)), "5% wide tap target is too small");
            Assert.IsFalse(ShadowLegibilityProfiles.IsUndersized(new LegibilityBox(0, 0, 0.12f, 0.12f)));
        }

        [Test] public void HeadTurn_And_PassthroughReadability()
        {
            Assert.IsTrue(ShadowLegibilityProfiles.RequiresExcessiveHeadTurn(45f), "45° off-center is too much head turn");
            Assert.IsFalse(ShadowLegibilityProfiles.RequiresExcessiveHeadTurn(15f));
            // on a busy passthrough (0.9) a 0.6-alpha panel is not opaque enough; 0.9 is
            Assert.IsFalse(ShadowLegibilityProfiles.PanelReadableOverPassthrough(0.6f, 0.9f));
            Assert.IsTrue(ShadowLegibilityProfiles.PanelReadableOverPassthrough(0.9f, 0.9f));
        }

        [Test] public void PerfSample_IsLabeledNotBeamPro()
        {
            Assert.AreEqual("NOT_BEAM_PRO_DEVICE_EVIDENCE", ShadowPerfSample.Provenance);
            var s = ShadowPerfBaseline.Snapshot(12f, 3f, 90f, 0, 40, 2);
            StringAssert.Contains("NOT_BEAM_PRO_DEVICE_EVIDENCE", s.ToString());
        }
    }
}
#endif
