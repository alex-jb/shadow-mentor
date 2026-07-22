// apps/shadow-lens/unity/Assets/ShadowLens/Device/ShadowTrackingState.cs
// Tracking health state machine. Maps the SDK's not-tracking reason to a health level the UI can act
// on, and enforces that GetTrackingType is only trusted after the loader has started (XREAL SDK 3.1
// crashes if queried earlier). The `Scanning` reason (new in SDK 3.1) is a distinct limited state,
// not a hard loss. Pure C# (no SDK dependency — the reason arrives as an enum we mirror). SOURCE AUTHORED.
namespace ShadowLens.Device
{
    // Mirror of the SDK's NotTrackingReason (we do not import the SDK here). Kept in sync with SDK 3.1.
    public enum ShadowNotTrackingReason { None, Initializing, Scanning, RelocalizationInProgress, Unknown }

    public sealed class ShadowTrackingState
    {
        public bool LoaderStarted { get; private set; }
        public ShadowTrackingHealth Health { get; private set; } = ShadowTrackingHealth.Nominal;
        public ShadowNotTrackingReason Reason { get; private set; } = ShadowNotTrackingReason.Initializing;

        // Before the loader starts, tracking type must NOT be queried; health stays Lost/Initializing.
        public void OnLoaderStarted() { LoaderStarted = true; }

        // Feed the SDK reason each frame (or on change). Fail-closed: unknown → Lost.
        public void Report(ShadowNotTrackingReason reason, bool isTracking)
        {
            Reason = reason;
            if (!LoaderStarted) { Health = ShadowTrackingHealth.Lost; return; }
            if (isTracking && reason == ShadowNotTrackingReason.None) { Health = ShadowTrackingHealth.Nominal; return; }
            switch (reason)
            {
                case ShadowNotTrackingReason.Scanning:
                case ShadowNotTrackingReason.RelocalizationInProgress:
                case ShadowNotTrackingReason.Initializing:
                    Health = ShadowTrackingHealth.Limited; break;
                default:
                    Health = ShadowTrackingHealth.Lost; break;
            }
        }

        public bool CanQueryTrackingType => LoaderStarted;   // guard against the pre-3.1 crash pattern
    }
}
