// apps/shadow-lens/unity/Assets/ShadowLens/Xreal/ShadowXrealInputAdapter.cs
// Reports the active XREAL input source. On this hardware the controller is a 3DoF phone controller;
// button/pointer input routes through the XR Interaction Toolkit (Input Actions), NOT a direct SDK
// GetButton — so this adapter exposes the source and defers action mapping to the existing InputV5
// router (which already enforces: hover != select, select != approve, destructive needs Confirm, and
// voice/controller never authorize a regulated action). Controller input is NEVER hand tracking.
// Gated by SHADOW_XREAL_SDK. SOURCE AUTHORED.
using Unity.XR.XREAL;

namespace ShadowLens.Xreal
{
    public sealed class ShadowXrealInputAdapter
    {
        // The controller is 3DoF (rotation only) — there is no positional (6DoF) controller on this device.
        public bool ControllerIs3DofOnly => true;
        public bool IsHandTracking => false;   // never described as hand tracking on One series
        // Canonical actions are produced by the XRI-driven InputV5 sources; this adapter only names the
        // source so diagnostics can show it. Reading XREALPlugin.InputSource is a device-runtime concern.
        public string SourceLabel(bool controllerConnected) => controllerConnected ? "XREAL 3DoF controller (via XRI)" : "no controller";
    }
}
