// apps/shadow-lens/unity/Assets/ShadowLens/Tests/DeviceReady/ShadowXrealMappingEditTests.cs
// EditMode tests for the pure XREAL tracking mapping — no SDK, no device. The SDK TrackingType ordinals
// (MODE_6DOF=0/MODE_3DOF=1/MODE_0DOF=2/MODE_0DOF_STAB=3) map to Core.TrackingMode, and 6DoF is NEVER
// claimed from the reported type alone — the fail-closed detector still requires Eye + observed
// translation. SOURCE AUTHORED.
#if UNITY_INCLUDE_TESTS
using NUnit.Framework;
using ShadowLens.Core;
using ShadowLens.Device;

namespace ShadowLens.Tests
{
    public class ShadowXrealMappingEditTests
    {
        [Test] public void TrackingType_MapsToCoreMode()
        {
            Assert.AreEqual(TrackingMode.SixDof, ShadowXrealTrackingMapper.FromTrackingType(ShadowXrealTrackingMapper.MODE_6DOF));
            Assert.AreEqual(TrackingMode.ThreeDof, ShadowXrealTrackingMapper.FromTrackingType(ShadowXrealTrackingMapper.MODE_3DOF));
            Assert.AreEqual(TrackingMode.None, ShadowXrealTrackingMapper.FromTrackingType(ShadowXrealTrackingMapper.MODE_0DOF));
            Assert.AreEqual(TrackingMode.None, ShadowXrealTrackingMapper.FromTrackingType(ShadowXrealTrackingMapper.MODE_0DOF_STAB));
        }

        [Test] public void TrackingType_UnknownBeforeLoaderStart()
        {
            Assert.AreEqual(TrackingMode.Unknown, ShadowXrealTrackingMapper.SafeFromTrackingType(false, ShadowXrealTrackingMapper.MODE_6DOF));
            Assert.AreEqual(TrackingMode.SixDof, ShadowXrealTrackingMapper.SafeFromTrackingType(true, ShadowXrealTrackingMapper.MODE_6DOF));
        }

        [Test] public void ReportedSixDof_AloneDoesNotProduceA6DofSession()
        {
            // A probe reporting SixDof but with NO Eye and NO translation must NOT resolve to 6DoF.
            var probe = new ShadowUnityDeviceProbe { XrealSdkRuntime = true, LoaderStarted = true, Reported = TrackingMode.SixDof, EyeAddOn = false, PositionalTranslation = false };
            var profile = ShadowDeviceCapabilityDetector.Detect(probe);
            Assert.IsFalse(profile.Has(ShadowCapability.TRACKING_6DOF), "reported 6DoF without Eye + translation is not 6DoF");
            Assert.IsTrue(profile.Has(ShadowCapability.TRACKING_3DOF));
        }

        [Test] public void FullEvidence_ProducesA6DofSession()
        {
            var probe = new ShadowUnityDeviceProbe { XrealSdkRuntime = true, LoaderStarted = true, Reported = TrackingMode.SixDof, EyeAddOn = true, PositionalTranslation = true, DeviceEvidence = true };
            var profile = ShadowDeviceCapabilityDetector.Detect(probe);
            Assert.IsTrue(profile.Has(ShadowCapability.TRACKING_6DOF));
            Assert.AreEqual(ShadowDegradationLevel.XrealEye6Dof, profile.Level);
        }
    }
}
#endif
