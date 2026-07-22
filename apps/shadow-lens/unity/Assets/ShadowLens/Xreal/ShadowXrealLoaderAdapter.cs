// apps/shadow-lens/unity/Assets/ShadowLens/Xreal/ShadowXrealLoaderAdapter.cs
// Typed adapter over the REAL XREAL SDK 3.1.0 loader. Subscribes to XREALXRLoader.OnXRLoaderStart /
// OnXRLoaderStop (confirmed static Action events) and drives Shadow's own ShadowXrealLoaderState, so
// the app never queries tracking before the loader has actually started (SDK 3.1 fixed the pre-start
// crash). Compiled ONLY when SHADOW_XREAL_SDK is set (the asmdef's defineConstraints excludes this
// whole assembly otherwise → the base project builds without the SDK). SOURCE AUTHORED · compiled
// against the imported SDK; device execution validated separately.
using UnityEngine;
using Unity.XR.XREAL;
using ShadowLens.Device;

namespace ShadowLens.Xreal
{
    public sealed class ShadowXrealLoaderAdapter
    {
        readonly ShadowXrealLoaderState _state = new ShadowXrealLoaderState();
        public ShadowXrealLoaderState State => _state;
        bool _subscribed;

        // isoTimestamp is injected (no Date.now); the caller stamps events.
        public void Subscribe(string isoTimestamp)
        {
            if (_subscribed) return;
            _state.Transition(ShadowXrealLoaderPhase.SDK_AVAILABLE, isoTimestamp, "SDK", "XREAL SDK present", "-", "XREALXRLoader");
            XREALXRLoader.OnXRLoaderStart += OnStart;
            XREALXRLoader.OnXRLoaderStop += OnStop;
            _subscribed = true;
        }

        public void Unsubscribe()
        {
            if (!_subscribed) return;
            XREALXRLoader.OnXRLoaderStart -= OnStart;
            XREALXRLoader.OnXRLoaderStop -= OnStop;
            _subscribed = false;
        }

        void OnStart()
        {
            // We only observe the real event; transition through STARTING → STARTED honestly.
            _state.Transition(ShadowXrealLoaderPhase.LOADER_STARTING, Now(), "START", "loader starting", "wait", "OnXRLoaderStart");
            _state.Transition(ShadowXrealLoaderPhase.LOADER_STARTED, Now(), "STARTED", "loader started", "-", "OnXRLoaderStart");
            Debug.Log("[ShadowXreal] loader started");
        }

        void OnStop()
        {
            _state.Transition(ShadowXrealLoaderPhase.LOADER_STOPPING, Now(), "STOPPING", "loader stopping", "-", "OnXRLoaderStop");
            _state.Transition(ShadowXrealLoaderPhase.LOADER_STOPPED, Now(), "STOPPED", "loader stopped", "-", "OnXRLoaderStop");
        }

        // The loader events carry no timestamp; we stamp with a monotonic frame marker (not wall-clock).
        static string Now() => "frame:" + Time.frameCount;

        // Tracking must not be queried until the loader has started.
        public bool CanQueryTracking => _state.CanQueryTracking;
    }
}
