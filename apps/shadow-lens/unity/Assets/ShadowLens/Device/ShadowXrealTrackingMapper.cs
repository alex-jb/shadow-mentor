// apps/shadow-lens/unity/Assets/ShadowLens/Device/ShadowXrealTrackingMapper.cs
// Pure mapping from the XREAL SDK's TrackingType (confirmed values MODE_6DOF=0, MODE_3DOF=1,
// MODE_0DOF=2, MODE_0DOF_STAB=3) to Shadow's Core.TrackingMode — WITHOUT referencing the SDK type, so
// it is EditMode-testable with no SDK/device. The gated ShadowXrealTrackingAdapter reads the real
// XREALPlugin.GetTrackingType() and passes its ordinal here. Honesty is still enforced downstream by
// ShadowDeviceCapabilityDetector: MODE_6DOF alone is NOT 6DoF — it needs the Eye add-on + observed
// positional translation. SOURCE AUTHORED.
namespace ShadowLens.Device
{
    public static class ShadowXrealTrackingMapper
    {
        // Ordinals mirror XREALPlugin.TrackingType (SDK 3.1.0). Kept here so the mapping is testable
        // and the gated adapter just forwards (int)XREALPlugin.GetTrackingType().
        public const int MODE_6DOF = 0, MODE_3DOF = 1, MODE_0DOF = 2, MODE_0DOF_STAB = 3;

        public static Core.TrackingMode FromTrackingType(int trackingTypeOrdinal)
        {
            switch (trackingTypeOrdinal)
            {
                case MODE_6DOF: return Core.TrackingMode.SixDof;   // reported 6DoF (still needs Eye + translation to CLAIM 6DoF)
                case MODE_3DOF: return Core.TrackingMode.ThreeDof;
                case MODE_0DOF:
                case MODE_0DOF_STAB: return Core.TrackingMode.None; // rotation-locked / stabilized 0DoF
                default: return Core.TrackingMode.Unknown;
            }
        }

        // The reported type is only meaningful AFTER the loader has started (SDK 3.1 rule).
        public static Core.TrackingMode SafeFromTrackingType(bool loaderStarted, int trackingTypeOrdinal)
            => loaderStarted ? FromTrackingType(trackingTypeOrdinal) : Core.TrackingMode.Unknown;
    }
}
