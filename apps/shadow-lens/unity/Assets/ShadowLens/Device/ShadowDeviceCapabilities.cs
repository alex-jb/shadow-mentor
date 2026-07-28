// apps/shadow-lens/unity/Assets/ShadowLens/Device/ShadowDeviceCapabilities.cs
// The ONE authoritative runtime capability model. Every device claim in the app flows through this
// so nothing can silently assert a capability the hardware does not have. Fail-closed by default:
// an undetected capability is UNSUPPORTED, never assumed.
//
// Official ground truth (do not soften — see docs/research/SHADOW_UNITY_XREAL_CURRENT_CAPABILITY_MATRIX.csv):
//   - XREAL One / One Pro base tracking is 3DoF.
//   - 6DoF requires the XREAL Eye add-on (SDK 3.1); Beam Pro is a test-compatible host; a MyGlasses /
//     firmware update is required. 6DoF is NEVER inferred from glasses presence alone.
//   - The One + RGB Camera compatibility table marks plane tracking, image tracking, hand tracking,
//     depth mesh, and spatial anchors as UNSUPPORTED. The controller is 3DoF.
// These five are ALWAYS-UNSUPPORTED on this target and are never exposed as available.
// Pure C# (no UnityEngine) so the model is EditMode-testable. SOURCE AUTHORED.
using System;
using System.Collections.Generic;

namespace ShadowLens.Device
{
    [Flags]
    public enum ShadowCapability : long
    {
        None = 0,
        PLATFORM_ANDROID = 1L << 0,
        PLATFORM_EDITOR = 1L << 1,
        PLATFORM_BEAM_PRO = 1L << 2,
        XREAL_SDK_AVAILABLE = 1L << 3,
        XREAL_LOADER_STARTED = 1L << 4,
        TRACKING_3DOF = 1L << 5,
        TRACKING_6DOF = 1L << 6,
        RGB_CAMERA_AVAILABLE = 1L << 7,
        FIRST_PERSON_VIEW_AVAILABLE = 1L << 8,
        CONTROLLER_3DOF = 1L << 9,
        EMULATOR_ACTIVE = 1L << 10,
        // The always-unsupported set on the One + RGB Camera target (official). Present in the enum
        // ONLY so the app can name them as explicitly unavailable — they are never turned on.
        PLANE_TRACKING_AVAILABLE = 1L << 11,
        IMAGE_TRACKING_AVAILABLE = 1L << 12,
        HAND_TRACKING_AVAILABLE = 1L << 13,
        DEPTH_MESH_AVAILABLE = 1L << 14,
        SPATIAL_ANCHOR_AVAILABLE = 1L << 15,
        DEVICE_VALIDATED = 1L << 16,
    }

    // Capabilities that are UNSUPPORTED on this target per the official compatibility table. The
    // detector clears these unconditionally, and a guard test asserts they can never be set.
    public static class ShadowOfficialLimits
    {
        public static readonly ShadowCapability AlwaysUnsupported =
            ShadowCapability.PLANE_TRACKING_AVAILABLE | ShadowCapability.IMAGE_TRACKING_AVAILABLE |
            ShadowCapability.HAND_TRACKING_AVAILABLE | ShadowCapability.DEPTH_MESH_AVAILABLE |
            ShadowCapability.SPATIAL_ANCHOR_AVAILABLE;
    }

    // Deterministic degradation ladder. Higher levels require strictly more (verified) capability.
    public enum ShadowDegradationLevel { DesktopMock = 0, AndroidMock = 1, Xreal3Dof = 2, XrealEye6Dof = 3 }

    // The user-facing runtime session state (mutually exclusive at any moment).
    public enum ShadowSessionState
    {
        DesktopMock, AndroidMock, Xreal3DofSession, XrealEye6DofSession,
        TrackingLimited, TrackingLost, CameraUnavailable, DeviceValidationPending,
    }

    // An immutable capability snapshot + the level/state it resolves to. Constructed only by the
    // detector, which enforces fail-closed rules.
    public sealed class ShadowDeviceCapabilityProfile
    {
        public ShadowCapability Flags { get; }
        public ShadowDegradationLevel Level { get; }
        public ShadowSessionState State { get; }

        public ShadowDeviceCapabilityProfile(ShadowCapability flags, ShadowDegradationLevel level, ShadowSessionState state)
        {
            Flags = flags; Level = level; State = state;
        }

        public bool Has(ShadowCapability c) => (Flags & c) == c;

        // The five always-unsupported capabilities are never present.
        public bool AnyUnsupportedClaimed => (Flags & ShadowOfficialLimits.AlwaysUnsupported) != 0;

        public IReadOnlyList<ShadowCapability> UnsupportedByOfficialLimit()
        {
            var list = new List<ShadowCapability>();
            foreach (ShadowCapability c in Enum.GetValues(typeof(ShadowCapability)))
                if (c != ShadowCapability.None && (ShadowOfficialLimits.AlwaysUnsupported & c) == c) list.Add(c);
            return list;
        }
    }
}
