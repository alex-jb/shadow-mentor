// apps/shadow-lens/unity/Assets/ShadowLens/Device/ShadowXrealLoaderState.cs
// Our own model of the XREAL XR loader lifecycle — deliberately independent of the SDK so it is pure
// and EditMode-testable. A real ShadowXrealLoaderAdapter (behind SHADOW_XREAL_SDK) drives these
// transitions from actual loader callbacks; this model never fakes loader state, and it enforces the
// official rule that tracking must not be queried until the loader has STARTED (SDK 3.1 crashed if
// queried earlier). Pure C#. SOURCE AUTHORED — no SDK API names here (fill them in the adapter after import).
using System.Collections.Generic;

namespace ShadowLens.Device
{
    public enum ShadowXrealLoaderPhase
    {
        NOT_COMPILED,          // SHADOW_XREAL_SDK not set — the base candidate
        SDK_AVAILABLE,         // SDK compiled in, loader not yet configured
        LOADER_NOT_CONFIGURED, // XR Plug-in Management has no XREAL loader for Android
        LOADER_STARTING,
        LOADER_STARTED,
        LOADER_FAILED,
        LOADER_STOPPING,
        LOADER_STOPPED,
    }

    public struct ShadowXrealLoaderEvent
    {
        public ShadowXrealLoaderPhase Phase;
        public string IsoTimestamp;      // injected; no Date.now
        public string DiagnosticCode;    // short stable code
        public string ExplanationEn;     // user-facing
        public string RecoveryEn;
        public string RawSdkResult;      // optional raw SDK string (safe subset), null when N/A
    }

    public sealed class ShadowXrealLoaderState
    {
        readonly List<ShadowXrealLoaderEvent> _log = new List<ShadowXrealLoaderEvent>();
        public ShadowXrealLoaderPhase Phase { get; private set; } = ShadowXrealLoaderPhase.NOT_COMPILED;

        // Tracking queries are allowed only once the loader has STARTED.
        public bool CanQueryTracking => Phase == ShadowXrealLoaderPhase.LOADER_STARTED;
        public IReadOnlyList<ShadowXrealLoaderEvent> Log => _log;

        // Allowed forward transitions (fail-closed: an unexpected jump is rejected and logged).
        static readonly Dictionary<ShadowXrealLoaderPhase, ShadowXrealLoaderPhase[]> Allowed = new Dictionary<ShadowXrealLoaderPhase, ShadowXrealLoaderPhase[]>
        {
            { ShadowXrealLoaderPhase.NOT_COMPILED, new[] { ShadowXrealLoaderPhase.SDK_AVAILABLE } },
            { ShadowXrealLoaderPhase.SDK_AVAILABLE, new[] { ShadowXrealLoaderPhase.LOADER_NOT_CONFIGURED, ShadowXrealLoaderPhase.LOADER_STARTING } },
            { ShadowXrealLoaderPhase.LOADER_NOT_CONFIGURED, new[] { ShadowXrealLoaderPhase.LOADER_STARTING } },
            { ShadowXrealLoaderPhase.LOADER_STARTING, new[] { ShadowXrealLoaderPhase.LOADER_STARTED, ShadowXrealLoaderPhase.LOADER_FAILED } },
            { ShadowXrealLoaderPhase.LOADER_STARTED, new[] { ShadowXrealLoaderPhase.LOADER_STOPPING, ShadowXrealLoaderPhase.LOADER_FAILED } },
            { ShadowXrealLoaderPhase.LOADER_FAILED, new[] { ShadowXrealLoaderPhase.LOADER_STARTING, ShadowXrealLoaderPhase.LOADER_STOPPED } },
            { ShadowXrealLoaderPhase.LOADER_STOPPING, new[] { ShadowXrealLoaderPhase.LOADER_STOPPED } },
            { ShadowXrealLoaderPhase.LOADER_STOPPED, new[] { ShadowXrealLoaderPhase.LOADER_STARTING } },
        };

        public bool Transition(ShadowXrealLoaderPhase to, string isoTimestamp, string code, string explanationEn, string recoveryEn, string rawSdkResult = null)
        {
            var ok = Allowed.TryGetValue(Phase, out var next) && System.Array.IndexOf(next, to) >= 0;
            var ev = new ShadowXrealLoaderEvent { Phase = ok ? to : Phase, IsoTimestamp = isoTimestamp, DiagnosticCode = ok ? code : "REJECTED_TRANSITION", ExplanationEn = explanationEn, RecoveryEn = recoveryEn, RawSdkResult = rawSdkResult };
            _log.Add(ev);
            if (ok) Phase = to;
            return ok;
        }

        // Safe fallback contract: on LOADER_FAILED the app must NOT claim any tracking and should drop
        // to a non-spatial (Android mock / 2D) experience. Callers check this.
        public bool RequiresSafeFallback => Phase == ShadowXrealLoaderPhase.LOADER_FAILED || Phase == ShadowXrealLoaderPhase.LOADER_NOT_CONFIGURED;
    }
}
