// apps/shadow-lens/unity/Assets/ShadowLens/Xreal/ShadowXrealDiagnosticsAdapter.cs
// Evidence-free diagnostic snapshot of the XREAL runtime (loader phase, reported tracking mode,
// camera capturing flag). Never records raw frames, evidence text, or secrets. Gated by
// SHADOW_XREAL_SDK. SOURCE AUTHORED.
using ShadowLens.Device;
using ShadowLens.Core;

namespace ShadowLens.Xreal
{
    public sealed class ShadowXrealDiagnosticsAdapter
    {
        public string Snapshot(ShadowXrealLoaderState loader, TrackingMode reportedMode, bool cameraCapturing)
        {
            return "xreal loader=" + (loader != null ? loader.Phase.ToString() : "null")
                 + " tracking=" + reportedMode
                 + " camera_capturing=" + (cameraCapturing ? "yes" : "no")
                 + " can_query_tracking=" + (loader != null && loader.CanQueryTracking);
        }
    }
}
