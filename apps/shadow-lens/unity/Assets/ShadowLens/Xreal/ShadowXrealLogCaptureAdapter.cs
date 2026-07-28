// apps/shadow-lens/unity/Assets/ShadowLens/Xreal/ShadowXrealLogCaptureAdapter.cs
// The XREAL SDK 3.1 can auto-save Logcat on app launch (xreal-auto-log AAR). This adapter documents
// that the three log domains stay SEPARATE — XREAL SDK logs, Shadow structured diagnostics, Android
// system logcat — and that Shadow's own diagnostics never include raw evidence/frames/secrets. The
// SDK's auto-log toggle is a project setting; this adapter only records our policy. Gated by
// SHADOW_XREAL_SDK. SOURCE AUTHORED.
namespace ShadowLens.Xreal
{
    public static class ShadowXrealLogCaptureAdapter
    {
        public const string Policy = "3 separate log domains: XREAL SDK auto-logcat | Shadow structured events (evidence-free) | Android system logcat";
        public static bool ShadowDiagnosticsAreEvidenceFree => true;
    }
}
