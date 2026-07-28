// EditMode NUnit tests for the PURE spatial geometry (no UnityEngine dependency, so these
// run in the Unity Test Runner with no headset). Expected numbers were cross-checked against
// an independent transliteration. Runs in Unity CI; NOT-COMPILED on the build host (no dotnet).
using NUnit.Framework;
using ShadowLens.Spatial;

namespace ShadowLens.Tests
{
    public class SpatialLayoutTests
    {
        const float EPS = 1e-4f;

        [Test]
        public void SourceOverlay_CenterBox_MapsToOriginPlusLift()
        {
            var p = SpatialLayout.SourceOverlayWorld(new NormalizedBox(0.2f, 0.2f, 0.6f, 0.6f), new V3(0, 1.2f, -1.5f), 0.6f, 0.8f);
            Assert.AreEqual(0f, p.x, EPS);       // center box → plane origin in X/Y
            Assert.AreEqual(1.2f, p.y, EPS);
            Assert.AreEqual(-1.495f, p.z, EPS);  // origin.z + zLift
        }

        [Test]
        public void SourceOverlay_TopLeft_IsUpAndLeft()
        {
            var p = SpatialLayout.SourceOverlayWorld(new NormalizedBox(0f, 0f, 0f, 0f), new V3(0, 0, 0), 1f, 1f);
            Assert.Less(p.x, 0f);   // normalized x=0 → left
            Assert.Greater(p.y, 0f); // normalized y=0 (top) → world up (flip)
        }

        [Test]
        public void AuditArc_Single_IsStraightAhead()
        {
            var a = SpatialLayout.AuditArc(1, 2f);
            Assert.AreEqual(1, a.Length);
            Assert.AreEqual(0f, a[0].x, EPS);
            Assert.AreEqual(-2f, a[0].z, EPS); // -Z is forward
        }

        [Test]
        public void AuditArc_Three_IsSymmetricAndCentered()
        {
            var a = SpatialLayout.AuditArc(3, 2f, 120f);
            Assert.AreEqual(a[0].x, -a[2].x, EPS);       // symmetric about center
            Assert.AreEqual(0f, a[1].x, EPS);            // middle straight ahead
            Assert.AreEqual(-2f, a[1].z, EPS);
            Assert.AreEqual(-1.7320508f, a[0].x, 1e-3f); // -sin(60)*2
        }

        [Test]
        public void RiskHeights_ClampsAndFloors()
        {
            var h = SpatialLayout.RiskHeights(new[] { -1f, 0f, 0.5f, 1f, 2f });
            Assert.AreEqual(0.02f, h[0], EPS); // negative clamped to floor
            Assert.AreEqual(0.02f, h[1], EPS); // zero risk still shows the base tile
            Assert.AreEqual(0.21f, h[2], EPS);
            Assert.AreEqual(0.40f, h[3], EPS);
            Assert.AreEqual(0.40f, h[4], EPS); // >1 clamped to max
        }

        [Test]
        public void VerificationCascade_StaggersDeterministically()
        {
            var c = SpatialLayout.VerificationCascade(3);
            Assert.AreEqual(0f, c[0].delaySec, EPS);
            Assert.AreEqual(0.08f, c[1].delaySec, EPS);
            Assert.AreEqual(-0.12f, c[2].y, EPS);
        }

        [Test]
        public void GlanceStrip_IsCentered()
        {
            var g = SpatialLayout.GlanceStrip(2, 0.3f, new V3(0, -0.4f, -1f));
            Assert.AreEqual(-0.15f, g[0].x, EPS);
            Assert.AreEqual(0.15f, g[1].x, EPS);
        }
    }
}
