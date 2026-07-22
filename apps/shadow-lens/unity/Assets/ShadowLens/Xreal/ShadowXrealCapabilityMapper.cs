// apps/shadow-lens/unity/Assets/ShadowLens/Xreal/ShadowXrealCapabilityMapper.cs
// Builds a ShadowUnityDeviceProbe from the REAL SDK facts (device type, reported tracking, head-pose
// translation) so the existing fail-closed ShadowDeviceCapabilityDetector produces the session state.
// It never turns on 6DoF from the SDK/type alone — the probe only reports what the SDK actually says;
// the detector requires Eye + SixDof + translation. Gated by SHADOW_XREAL_SDK. SOURCE AUTHORED.
using Unity.XR.XREAL;
using ShadowLens.Core;
using ShadowLens.Device;

namespace ShadowLens.Xreal
{
    public sealed class ShadowXrealCapabilityMapper
    {
        readonly ShadowXrealTrackingAdapter _tracking;
        public ShadowXrealCapabilityMapper(ShadowXrealTrackingAdapter tracking) { _tracking = tracking; }

        // Fill a probe from real SDK state. eyeDetected must come from a genuine runtime Eye check on
        // device (not the SDK/package presence) — passed in by the caller, defaulting false (fail closed).
        public ShadowUnityDeviceProbe BuildProbe(bool loaderStarted, bool eyeDetected, bool controllerConnected = false)
        {
            return new ShadowUnityDeviceProbe
            {
                XrealSdkRuntime = true,
                LoaderStarted = loaderStarted,
                Reported = _tracking.ReportedMode(loaderStarted),
                EyeAddOn = eyeDetected,                                   // never inferred from the SDK
                PositionalTranslation = _tracking.PositionalTranslationObserved(loaderStarted),
                Controller3Dof = controllerConnected,                    // 3DoF phone controller; caller confirms connection
                BeamProHost = false,                                     // set only by an explicit host identification
                DeviceEvidence = false,                                  // set only when hardware evidence is captured
            };
        }

        public bool IsOneSeriesGlasses() => XREALPlugin.IsOneSeriesGlasses();
    }
}
