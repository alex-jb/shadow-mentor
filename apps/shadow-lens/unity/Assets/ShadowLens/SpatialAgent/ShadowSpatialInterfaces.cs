// apps/shadow-lens/unity/Assets/ShadowLens/SpatialAgent/ShadowSpatialInterfaces.cs
// The seams the protocol layer is written against. Gate 1 mock implementations return
// deterministic results; Gate 2 binds these to the real institutional Unity UI + scene.
// SOURCE AUTHORED · UNITY COMPILE PENDING.
#if UNITY_2020_1_OR_NEWER
using System;

namespace ShadowLens.SpatialAgent
{
    // The renderer performs the VISIBLE change and returns whether one actually happened
    // (so the router reports EXECUTED vs RENDER_FAILED honestly — never a silent no-op).
    public interface IShadowSpatialRenderer
    {
        bool SetMode(string mode);
        bool SelectObject(string id);
        bool FocusObject(string id);
        bool Highlight(string id);
        bool MoveCameraTo(string id);
        bool StartWalkthrough(string kind);
        bool ShowTamperDiff();
        bool ShowVerificationFailure();
        bool ReturnToWorkspace();
        bool ClearSelection();
        bool Supports(string action);
    }

    public interface IShadowSceneObjectResolver { bool Has(string id); string[] AllIds(); }
    public interface IShadowAnswerView { void ShowAnswer(ShadowGroundedAnswerModel answer); void Clear(); }
    public interface IShadowCitationView { void ShowCitations(ShadowCitationModel[] citations); }
    public interface IShadowActionStatusView { void SetLastAction(string line); void SetState(string state); }
    public interface IShadowProfileWorkspace { string Id { get; } string DefaultMode { get; } string[] Modes { get; } }

    // Transport seam: mock (fixture, synchronous) vs live (UnityWebRequest). Callback-based so
    // EditMode tests can drive it without coroutines.
    public struct ShadowTransportResult { public bool ok; public int status; public string body; public string error; }
    public interface IShadowSpatialTransport { void Send(string url, string jsonBody, int timeoutMs, Action<ShadowTransportResult> onResult); }
}
#endif
