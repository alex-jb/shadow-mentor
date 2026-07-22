// apps/shadow-lens/unity/Assets/ShadowLens/Device/ShadowDeviceCapabilityDetector.cs
// Composes a ShadowDeviceCapabilityProfile from RAW probe facts, fail-closed. The detector is the
// only place that decides what the app is allowed to claim. It refuses every unsafe inference:
//   - Beam Pro is NOT inferred from Android alone (needs an explicit host signal).
//   - 6DoF is NOT inferred from glasses presence or a compiled SDK symbol — it needs the Eye add-on
//     detected at runtime, a reported SixDof mode, AND observed positional translation.
//   - First-person view is NOT claimed until a real non-black frame is seen.
//   - The five officially-unsupported capabilities (plane/image/hand tracking, depth mesh, anchors)
//     are cleared unconditionally.
// Pure C# (no UnityEngine); a real platform/SDK adapter implements IShadowDeviceProbe. SOURCE AUTHORED.
namespace ShadowLens.Device
{
    // Raw, un-derived facts a platform/SDK layer reports. Everything here is an observation, not a
    // conclusion — the detector draws the conclusions.
    public interface IShadowDeviceProbe
    {
        bool IsEditor { get; }
        bool IsAndroid { get; }
        bool IsBeamProHost { get; }               // explicit host identification, never Android-implied
        bool XrealSdkAvailableAtRuntime { get; }  // runtime presence, not a compile symbol
        bool XrealLoaderStarted { get; }
        Core.TrackingMode ReportedTrackingMode { get; }
        bool EyeAddOnDetected { get; }            // runtime detection of the XREAL Eye add-on
        bool PositionalTranslationObserved { get; } // real 6DoF proof
        bool RgbCameraPresent { get; }
        bool NonBlackFrameObserved { get; }
        bool Controller3DofConnected { get; }
        bool EmulatorActive { get; }
        bool DeviceValidationEvidencePresent { get; } // only true when hardware evidence was captured
    }

    // Health hint fed in separately by the tracking state machine at runtime (Limited/Lost override).
    public enum ShadowTrackingHealth { Nominal, Limited, Lost }

    public static class ShadowDeviceCapabilityDetector
    {
        public static ShadowDeviceCapabilityProfile Detect(IShadowDeviceProbe p, ShadowTrackingHealth health = ShadowTrackingHealth.Nominal)
        {
            if (p == null) return new ShadowDeviceCapabilityProfile(ShadowCapability.None, ShadowDegradationLevel.DesktopMock, ShadowSessionState.DesktopMock);

            var f = ShadowCapability.None;
            if (p.IsEditor) f |= ShadowCapability.PLATFORM_EDITOR;
            if (p.IsAndroid) f |= ShadowCapability.PLATFORM_ANDROID;
            if (p.IsBeamProHost) f |= ShadowCapability.PLATFORM_BEAM_PRO;   // explicit only
            if (p.EmulatorActive) f |= ShadowCapability.EMULATOR_ACTIVE;

            bool sdk = p.XrealSdkAvailableAtRuntime;
            if (sdk) f |= ShadowCapability.XREAL_SDK_AVAILABLE;
            bool loader = sdk && p.XrealLoaderStarted;
            if (loader) f |= ShadowCapability.XREAL_LOADER_STARTED;

            // 3DoF requires a started loader reporting at least 3DoF.
            bool threeDof = loader && (p.ReportedTrackingMode == Core.TrackingMode.ThreeDof || p.ReportedTrackingMode == Core.TrackingMode.SixDof);
            if (threeDof) f |= ShadowCapability.TRACKING_3DOF;

            // 6DoF requires ALL of: Eye add-on detected, reported SixDof, positional translation seen.
            bool sixDof = loader && p.EyeAddOnDetected && p.ReportedTrackingMode == Core.TrackingMode.SixDof && p.PositionalTranslationObserved;
            if (sixDof) f |= ShadowCapability.TRACKING_6DOF;

            if (p.Controller3DofConnected) f |= ShadowCapability.CONTROLLER_3DOF;   // controller is 3DoF max
            if (p.RgbCameraPresent) f |= ShadowCapability.RGB_CAMERA_AVAILABLE;
            if (p.RgbCameraPresent && p.NonBlackFrameObserved) f |= ShadowCapability.FIRST_PERSON_VIEW_AVAILABLE;

            // Device validation only when real hardware evidence exists and we are not in editor/emulator.
            if (p.DeviceValidationEvidencePresent && !p.IsEditor && !p.EmulatorActive) f |= ShadowCapability.DEVICE_VALIDATED;

            // Officially-unsupported capabilities are cleared unconditionally (fail closed).
            f &= ~ShadowOfficialLimits.AlwaysUnsupported;

            var level = ResolveLevel(f);
            var state = ResolveState(f, level, health, p);
            return new ShadowDeviceCapabilityProfile(f, level, state);
        }

        static ShadowDegradationLevel ResolveLevel(ShadowCapability f)
        {
            if ((f & ShadowCapability.TRACKING_6DOF) != 0) return ShadowDegradationLevel.XrealEye6Dof;
            if ((f & ShadowCapability.TRACKING_3DOF) != 0) return ShadowDegradationLevel.Xreal3Dof;
            if ((f & ShadowCapability.PLATFORM_ANDROID) != 0) return ShadowDegradationLevel.AndroidMock;
            return ShadowDegradationLevel.DesktopMock;
        }

        static ShadowSessionState ResolveState(ShadowCapability f, ShadowDegradationLevel level, ShadowTrackingHealth health, IShadowDeviceProbe p)
        {
            // Tracking health overrides the spatial levels.
            if (level >= ShadowDegradationLevel.Xreal3Dof)
            {
                if (health == ShadowTrackingHealth.Lost) return ShadowSessionState.TrackingLost;
                if (health == ShadowTrackingHealth.Limited) return ShadowSessionState.TrackingLimited;
            }
            switch (level)
            {
                case ShadowDegradationLevel.XrealEye6Dof:
                    // If 6DoF is up but the camera path is expected yet unavailable, surface it.
                    if (p.RgbCameraPresent && !p.NonBlackFrameObserved) return ShadowSessionState.CameraUnavailable;
                    return p.DeviceValidationEvidencePresent ? ShadowSessionState.XrealEye6DofSession : ShadowSessionState.DeviceValidationPending;
                case ShadowDegradationLevel.Xreal3Dof:
                    return p.DeviceValidationEvidencePresent ? ShadowSessionState.Xreal3DofSession : ShadowSessionState.DeviceValidationPending;
                case ShadowDegradationLevel.AndroidMock:
                    return ShadowSessionState.AndroidMock;
                default:
                    return ShadowSessionState.DesktopMock;
            }
        }
    }
}
