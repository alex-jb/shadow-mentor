// apps/shadow-lens/unity/Assets/ShadowLens/Tests/ShadowTrackingStatePinTests.cs
// EditMode tests that PIN the existing tracking-state semantics (verify + consolidate, NOT rewrite).
// Locks the two V11-critical invariants so a future edit can't regress them:
//   * SCANNING is an explicit Limited state — it must NOT fall into the generic default(→Lost) branch.
//   * Fail-closed: any unknown reason → Lost; nothing is trusted before the loader starts.
// Pure C# state machine (no SDK). AUTHORED — run in Unity 6.
#if UNITY_INCLUDE_TESTS
using NUnit.Framework;
using ShadowLens.Device;

namespace ShadowLens.Tests
{
    public class ShadowTrackingStatePinTests
    {
        static ShadowTrackingState Started()
        {
            var s = new ShadowTrackingState();
            s.OnLoaderStarted();
            return s;
        }

        [Test] public void Scanning_IsLimited_NotDefaultLost()
        {
            var s = Started();
            s.Report(ShadowNotTrackingReason.Scanning, isTracking: false);
            Assert.AreEqual(ShadowTrackingHealth.Limited, s.Health, "Scanning must be an explicit Limited state");
            Assert.AreEqual(ShadowNotTrackingReason.Scanning, s.Reason);
        }

        [Test] public void InitializingAndRelocalizing_AreLimited()
        {
            var s = Started();
            s.Report(ShadowNotTrackingReason.Initializing, false);
            Assert.AreEqual(ShadowTrackingHealth.Limited, s.Health);
            s.Report(ShadowNotTrackingReason.RelocalizationInProgress, false);
            Assert.AreEqual(ShadowTrackingHealth.Limited, s.Health);
        }

        [Test] public void Unknown_FailsClosedToLost()
        {
            var s = Started();
            s.Report(ShadowNotTrackingReason.Unknown, false);
            Assert.AreEqual(ShadowTrackingHealth.Lost, s.Health, "unknown reason must fail closed to Lost");
        }

        [Test] public void Tracking_WithNoneReason_IsNominal()
        {
            var s = Started();
            s.Report(ShadowNotTrackingReason.None, isTracking: true);
            Assert.AreEqual(ShadowTrackingHealth.Nominal, s.Health);
        }

        [Test] public void NothingTrustedBeforeLoaderStarts()
        {
            var s = new ShadowTrackingState();               // loader NOT started
            Assert.IsFalse(s.CanQueryTrackingType, "must not query tracking type before the loader starts (SDK 3.1 crash guard)");
            s.Report(ShadowNotTrackingReason.None, isTracking: true);
            Assert.AreEqual(ShadowTrackingHealth.Lost, s.Health, "health stays Lost until the loader starts");
        }

        [Test] public void EveryReason_MapsToAKnownHealth_NoUnhandledFallthrough()
        {
            var s = Started();
            foreach (ShadowNotTrackingReason reason in System.Enum.GetValues(typeof(ShadowNotTrackingReason)))
            {
                s.Report(reason, isTracking: false);
                Assert.That(s.Health, Is.EqualTo(ShadowTrackingHealth.Limited).Or.EqualTo(ShadowTrackingHealth.Lost),
                    "reason " + reason + " must resolve to Limited or Lost, never an undefined state");
            }
        }
    }
}
#endif
