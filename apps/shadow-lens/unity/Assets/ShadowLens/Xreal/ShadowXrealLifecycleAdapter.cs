// apps/shadow-lens/unity/Assets/ShadowLens/Xreal/ShadowXrealLifecycleAdapter.cs
// Application + glasses lifecycle bridge. On app pause it signals the voice/queue + loader to suspend
// safely; on a glasses-exit notification it drives a clean shutdown path. The actual glasses-exit
// event wiring is a device-runtime concern; this adapter exposes the hooks the app calls. Gated by
// SHADOW_XREAL_SDK. SOURCE AUTHORED.
using System;

namespace ShadowLens.Xreal
{
    public sealed class ShadowXrealLifecycleAdapter
    {
        public event Action OnPauseRequested;
        public event Action OnResumeRequested;
        public event Action OnGlassesExit;

        public void AppPause(bool paused) { if (paused) OnPauseRequested?.Invoke(); else OnResumeRequested?.Invoke(); }
        public void GlassesExit() { OnGlassesExit?.Invoke(); }   // wired to the SDK glasses-exit notification on device
    }
}
