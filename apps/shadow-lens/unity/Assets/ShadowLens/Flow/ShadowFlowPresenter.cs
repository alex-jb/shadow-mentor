// apps/shadow-lens/unity/Assets/ShadowLens/Flow/ShadowFlowPresenter.cs
// The Unity Flow boundary (mirrors flow-presenter.mjs). Flow is a SEPARATE presentation layer, not a
// runtime dependency of the deterministic Mock demo. The offline presenter prepares a handoff to
// DISPLAY and NEVER makes a network request; a future web/API presenter is behind a feature flag and
// stays inert unless enabled. SOURCE AUTHORED · compiled in Unity 6. No credentials, no network in mock.
#if UNITY_2020_1_OR_NEWER
namespace ShadowLens.Flow
{
    public struct ShadowFlowHandoff
    {
        public bool prepared;
        public string title;
        public string caseId;
        public bool networkUsed;
        public string explanation;
    }

    public interface IShadowFlowPresenter { string Kind { get; } ShadowFlowHandoff Prepare(string caseId, string title); }

    // Offline: prepares + references the export locally. No network. No credentials.
    public class ShadowOfflineFlowPresenter : IShadowFlowPresenter
    {
        public string Kind => "offline-mock";
        public ShadowFlowHandoff Prepare(string caseId, string title) => new ShadowFlowHandoff {
            prepared = true, title = title, caseId = caseId, networkUsed = false,
            explanation = "Flow dataset prepared offline. The full Flow spatial story is launched separately — this demo does not embed or fetch it.",
        };
    }

    // Future live presenter — inert unless the explicit feature flag is enabled. Never used by the Mock.
    public class ShadowWebApiFlowPresenter : IShadowFlowPresenter
    {
        readonly bool _enabled;
        public ShadowWebApiFlowPresenter(bool enabled) { _enabled = enabled; }
        public string Kind => "web-api";
        public ShadowFlowHandoff Prepare(string caseId, string title)
        {
            if (!_enabled) return new ShadowFlowHandoff { prepared = false, caseId = caseId, networkUsed = false, explanation = "live Flow presenter disabled (feature flag off)" };
            // a real impl would POST the export to the Flow workspace API here (behind the flag).
            return new ShadowFlowHandoff { prepared = true, title = title, caseId = caseId, networkUsed = true, explanation = "live Flow presenter (feature-flagged)" };
        }
    }
}
#endif
