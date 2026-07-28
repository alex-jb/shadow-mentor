// apps/shadow-lens/unity/Assets/ShadowLens/Device/ShadowUnityDeviceProbe.cs
// The default runtime probe. In the BASE Android candidate (no XREAL SDK compiled in), it reports
// only what Unity itself can prove — platform + editor — and FAIL-CLOSES every XREAL/6DoF/camera
// fact to false. A real XREAL adapter (behind SHADOW_XREAL_SDK) supplies the tracking/camera facts;
// this base probe never guesses them from the platform. SOURCE AUTHORED · UNITY-COMPILED.
#if UNITY_2020_1_OR_NEWER
using UnityEngine;
using ShadowLens.Core;

namespace ShadowLens.Device
{
    public sealed class ShadowUnityDeviceProbe : IShadowDeviceProbe
    {
        // Overridable seams so the XREAL adapter (or a test) can inject real facts without this base
        // probe ever inferring them. All default false = fail closed.
        public bool XrealSdkRuntime, LoaderStarted, EyeAddOn, PositionalTranslation, RgbCamera, NonBlackFrame, Controller3Dof, BeamProHost, DeviceEvidence;
        public TrackingMode Reported = TrackingMode.None;

        public bool IsEditor => Application.isEditor;
        public bool IsAndroid => Application.platform == RuntimePlatform.Android;
        public bool IsBeamProHost => BeamProHost;                       // never inferred from Android
        public bool XrealSdkAvailableAtRuntime => XrealSdkRuntime;
        public bool XrealLoaderStarted => LoaderStarted;
        public TrackingMode ReportedTrackingMode => Reported;
        public bool EyeAddOnDetected => EyeAddOn;
        public bool PositionalTranslationObserved => PositionalTranslation;
        public bool RgbCameraPresent => RgbCamera;
        public bool NonBlackFrameObserved => NonBlackFrame;
        public bool Controller3DofConnected => Controller3Dof;
        public bool EmulatorActive => Application.isEditor;             // Editor path is treated as emulator for validation gating
        public bool DeviceValidationEvidencePresent => DeviceEvidence;  // set only when hardware evidence is captured
    }
}
#endif
