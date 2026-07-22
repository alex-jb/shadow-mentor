// apps/shadow-lens/unity/Assets/ShadowLens/Device/ShadowDeviceCapabilityBanner.cs
// A thin, always-honest runtime banner. It runs the detector against the injected probe and shows
// the resolved session state's label — so the user always sees DESKTOP MOCK / ANDROID MOCK / XREAL
// 3DOF / DEVICE VALIDATION PENDING etc., and never a claim the hardware can't back. World-space text
// uses TextMesh (uGUI/TextMesh is correct for world-space; UI Toolkit is not used for 3D world UI).
// SOURCE AUTHORED · UNITY-COMPILED.
#if UNITY_2020_1_OR_NEWER
using UnityEngine;

namespace ShadowLens.Device
{
    public sealed class ShadowDeviceCapabilityBanner : MonoBehaviour
    {
        public bool Zh;
        TextMesh _text;
        ShadowUnityDeviceProbe _probe;
        ShadowTrackingState _tracking;
        public ShadowDeviceCapabilityProfile Profile { get; private set; }

        void Awake()
        {
            _probe = new ShadowUnityDeviceProbe();
            _tracking = new ShadowTrackingState();
            _text = GetComponent<TextMesh>();
            if (_text == null) _text = gameObject.AddComponent<TextMesh>();
            _text.anchor = TextAnchor.MiddleCenter;
            _text.characterSize = 0.5f;
            _text.fontSize = 64;
            Refresh();
        }

        // Re-detect and repaint. Call after any capability/tracking change.
        public void Refresh()
        {
            Profile = ShadowDeviceCapabilityDetector.Detect(_probe, _tracking.Health);
            var info = ShadowSessionStateInfo.Get(Profile.State);
            _text.text = info.Label(Zh);
            _text.color = ColorFor(Profile.State);
        }

        static Color ColorFor(ShadowSessionState s)
        {
            switch (s)
            {
                case ShadowSessionState.XrealEye6DofSession: return new Color(0.29f, 0.87f, 0.50f);
                case ShadowSessionState.TrackingLost:
                case ShadowSessionState.CameraUnavailable: return new Color(0.94f, 0.27f, 0.27f);
                case ShadowSessionState.TrackingLimited: return new Color(0.98f, 0.75f, 0.14f);
                default: return new Color(0.98f, 0.75f, 0.14f); // amber for all mock / pending states
            }
        }

        // Seams for tests / the XREAL adapter to feed real facts (never inferred by the base probe).
        public ShadowUnityDeviceProbe Probe => _probe;
        public ShadowTrackingState Tracking => _tracking;
    }
}
#endif
