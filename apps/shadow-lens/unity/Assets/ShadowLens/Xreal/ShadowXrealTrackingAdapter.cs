// apps/shadow-lens/unity/Assets/ShadowLens/Xreal/ShadowXrealTrackingAdapter.cs
// Typed tracking adapter over the REAL SDK: reads XREALPlugin.GetTrackingType() and the head pose via
// XREALPlugin.GetDevicePoseFromHead(XREALComponent.XREAL_COMPONENT_HEAD, ref Pose). It maps the SDK's
// TrackingType through the pure ShadowXrealTrackingMapper, and it NEVER claims 6DoF from the reported
// type alone — 6DoF requires the Eye add-on + observed positional translation (enforced downstream by
// ShadowDeviceCapabilityDetector). Only queried after the loader has started. Gated by SHADOW_XREAL_SDK.
// SOURCE AUTHORED · compiled against the imported SDK.
using UnityEngine;
using Unity.XR.XREAL;
using ShadowLens.Core;
using ShadowLens.Device;

namespace ShadowLens.Xreal
{
    public sealed class ShadowXrealTrackingAdapter
    {
        Vector3 _origin; bool _haveOrigin, _translated;

        // Reported tracking mode, mapped to Shadow's Core.TrackingMode. Returns Unknown before loader start.
        public TrackingMode ReportedMode(bool loaderStarted)
            => ShadowXrealTrackingMapper.SafeFromTrackingType(loaderStarted, (int)XREALPlugin.GetTrackingType());

        // True once REAL positional translation is observed (the honest 6DoF proof) — noisy sub-cm jitter
        // does not count.
        public bool PositionalTranslationObserved(bool loaderStarted)
        {
            if (!loaderStarted) return false;
            var pose = new Pose();
            if (!XREALPlugin.GetDevicePoseFromHead(XREALComponent.XREAL_COMPONENT_HEAD, ref pose)) return false;
            if (!_haveOrigin) { _origin = pose.position; _haveOrigin = true; return false; }
            if ((pose.position - _origin).magnitude > 0.05f) _translated = true;  // > 5 cm real translation
            return _translated;
        }

        public bool GetHeadPose(bool loaderStarted, ref Pose pose)
            => loaderStarted && XREALPlugin.GetDevicePoseFromHead(XREALComponent.XREAL_COMPONENT_HEAD, ref pose);
    }
}
