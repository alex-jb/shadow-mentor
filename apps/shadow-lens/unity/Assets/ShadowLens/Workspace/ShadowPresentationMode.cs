// apps/shadow-lens/unity/Assets/ShadowLens/Workspace/ShadowPresentationMode.cs
// The two V11 presentation modes and the state that MUST survive a mode switch. PrimitiveDiagnostic
// keeps the old procedural sphere/cube rendering for regression + before/after captures;
// AuditWorkspace is the new default product view. Switching modes preserves story step, selection,
// focus, language, verification/first-failure/downstream status, and human review/approval + tracking
// — nothing is silently reset. Pure C# (no UnityEngine) so it is EditMode-testable headlessly.
#if UNITY_2020_1_OR_NEWER
namespace ShadowLens.Workspace
{
    public enum ShadowPresentationMode
    {
        PrimitiveDiagnostic, // procedural diagnostic primitives (regression / before-after)
        AuditWorkspace,      // DEFAULT V11 product view (cards + rail + focus)
        // future (NOT implemented this increment):
        EvidenceConstellation,
        CouncilLanes,
    }

    // The preserved workspace state. A mode switch copies this verbatim.
    public struct ShadowWorkspaceState
    {
        public int StepIndex;
        public string SelectionEntityId;
        public string FocusEntityId;
        public bool Zh;                 // language
        public string Verification;     // canonical status of the focus
        public string FirstFailureId;
        public int DownstreamAffectedCount;
        public string HumanReview;
        public string Approval;
        public string Tracking;         // INITIALIZING/SCANNING/TRACKED_3DOF/TRACKED_6DOF/LIMITED/LOST/RECOVERING

        public ShadowWorkspaceState Clone() => this; // value type — copy is deep for these fields
    }

    public static class ShadowPresentationModes
    {
        public static bool IsImplemented(ShadowPresentationMode m)
            => m == ShadowPresentationMode.PrimitiveDiagnostic || m == ShadowPresentationMode.AuditWorkspace;

        public static ShadowPresentationMode Default => ShadowPresentationMode.AuditWorkspace;

        // Switch mode WITHOUT mutating the preserved state. Returns the same state; the caller re-renders
        // under the new mode. Guarded so an unimplemented mode never becomes active this increment.
        public static (ShadowPresentationMode mode, ShadowWorkspaceState state) SwitchMode(
            ShadowPresentationMode target, ShadowWorkspaceState state)
        {
            var mode = IsImplemented(target) ? target : Default;
            return (mode, state); // state is copied by value — every field preserved
        }
    }
}
#endif
