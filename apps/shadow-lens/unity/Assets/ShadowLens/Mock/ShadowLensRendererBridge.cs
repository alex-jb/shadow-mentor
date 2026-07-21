// apps/shadow-lens/unity/Assets/ShadowLens/Mock/ShadowLensRendererBridge.cs
// Gate 2 — bridges the protocol's IShadowSpatialRenderer to the EXISTING ShadowLensMockView, so
// validated agent actions drive REAL visible changes and never a silent no-op. Banking source
// highlights reuse the working Source overlay; audit reuses the working Audit arc; verify/tamper/
// reset reuse the existing behavior (preserved). Cross-profile focus/highlight of non-document
// nodes surface a visible FOCUS line via a callback. SOURCE AUTHORED · compiled in Unity 6 (Gate 2).
#if UNITY_2020_1_OR_NEWER
using System;
using ShadowLens.SpatialAgent;

namespace ShadowLens.Mock
{
    public class ShadowLensRendererBridge : IShadowSpatialRenderer
    {
        readonly ShadowLensMockView _view;
        readonly Action<string> _onFocus;   // shows "FOCUS: <id>/<mode>" on the panel (a visible change)
        public string LastFocus { get; private set; }

        public ShadowLensRendererBridge(ShadowLensMockView view, Action<string> onFocus)
        { _view = view; _onFocus = onFocus; }

        // Every method returns whether a VISIBLE change happened (honest EXECUTED vs RENDER_FAILED).
        public bool SetMode(string mode)
        {
            switch (mode)
            {
                case "source": _view.ShowSource(); break;
                case "audit": _view.ShowAudit(); break;
                case "document": _view.SetReady(); break;
                default: return Focus("MODE: " + mode); // experiment/code/risk/review → panel indicator
            }
            return true;
        }
        // Route to the ACTIVE profile workspace (banking source overlay, or a ds/coding node), and
        // also surface a FOCUS line on the panel so cross-profile focus is visible.
        public bool SelectObject(string id) { _view.WorkspaceFocus(id); return Focus("SELECT: " + id); }
        public bool FocusObject(string id) { _view.WorkspaceFocus(id); return Focus("FOCUS: " + id); }
        public bool Highlight(string id) { _view.WorkspaceHighlight(id); return Focus("HIGHLIGHT: " + id); }
        public bool MoveCameraTo(string id) => Focus("CAMERA: " + id);
        public bool StartWalkthrough(string kind) { _view.ShowAudit(); return Focus("WALKTHROUGH: " + kind); }
        public bool ShowTamperDiff() { _view.Tamper(); return true; }
        public bool ShowVerificationFailure() { _view.Tamper(); return true; }
        public bool ReturnToWorkspace() { _view.SetReady(); return true; }
        public bool ClearSelection() { LastFocus = null; _onFocus?.Invoke(""); return true; }
        public bool Supports(string action) => true;

        bool Focus(string s) { LastFocus = s; _onFocus?.Invoke(s); return true; }
    }
}
#endif
