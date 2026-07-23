// apps/shadow-lens/unity/Assets/ShadowLens/Workspace/ShadowAuditWorkspaceDeviceBootstrap.cs
// Device bootstrap: instantiates the REAL ShadowAuditWorkspace as the default view for the Beam Pro
// candidate build, binds the sanitized Banking guided-story fixture, and lays it out session-relative
// (3DoF-friendly — no walking required). Simple keyboard/controller Prev/Next/Select map the same
// dispatch as desktop. This is the minimal wiring that makes the workspace appear on device; the
// heavy logic lives in the tested pure classes. Camera/OCR stay OFF. NOT a device-validation claim.
#if UNITY_2020_1_OR_NEWER
using UnityEngine;
using ShadowLens.GuidedStory;
using P = ShadowLens.Design.ShadowDesignTokens.ShadowVisualProfile;

namespace ShadowLens.Workspace
{
    public sealed class ShadowAuditWorkspaceDeviceBootstrap : MonoBehaviour
    {
        public P Profile = P.XrealOstBright; // OST-bright default for glasses; DesktopDark for flat preview
        public bool Zh = false;

        ShadowAuditWorkspace _ws;
        GuidedStorySemantic _model;
        StoryScenario _scenario;
        int _focusIndex;
        string[] _order;

        static GuidedStorySemantic Model()
        {
            var m = new GuidedStorySemantic { StoryId = "banking", Title = new Bilingual { En = "Banking Audit", Zh = "银行审计" } };
            m.Entities.Add(new StoryEntity { Id = "income", Kind = "record", Sequence = 1, Label = new Bilingual { En = "Income", Zh = "收入" }, EvidenceRef = "ev.income" });
            m.Entities.Add(new StoryEntity { Id = "dti", Kind = "record", Sequence = 2, Label = new Bilingual { En = "DTI", Zh = "债务收入比" }, EvidenceRef = "ev.dti" });
            m.Entities.Add(new StoryEntity { Id = "decision", Kind = "decision", Sequence = 3, Label = new Bilingual { En = "Council Decision", Zh = "委员会决策" }, EvidenceRef = null });
            m.Entities.Add(new StoryEntity { Id = "pricing", Kind = "record", Sequence = 4, Label = new Bilingual { En = "Pricing Tier", Zh = "定价档位" }, EvidenceRef = "ev.pricing" });
            return m;
        }
        static StoryScenario Scenario()
        {
            var sc = new StoryScenario { Id = "s", FirstFailure = "decision" };
            sc.AffectedDownstream.Add("pricing");
            sc.EntityStatus["income"] = "VERIFIED"; sc.EntityStatus["dti"] = "VERIFIED";
            sc.EntityStatus["decision"] = "FIRST_FAILURE"; sc.EntityStatus["pricing"] = "AFFECTED_DOWNSTREAM";
            sc.DimensionStatus["HUMAN_REVIEW"] = "REQUIRES_HUMAN_REVIEW";
            sc.DimensionStatus["HUMAN_APPROVAL"] = "APPROVAL_NOT_PRESENT";
            sc.DimensionStatus["TRUST_POSTURE"] = "SELF_SIGNED";
            return sc;
        }

        void Awake()
        {
            gameObject.AddComponent<ShadowDeviceDiag>(); // process-specific device diagnostics (SHADOW_DEVICE_DIAG)
            _model = Model(); _scenario = Scenario();
            _order = new[] { "income", "dti", "decision", "pricing" };
            var go = new GameObject("AuditWorkspace");
            go.transform.SetParent(transform, false);
            _ws = go.AddComponent<ShadowAuditWorkspace>();
            _ws.Profile = Profile; _ws.Zh = Zh; _ws.Tracking = "TRACKED_3DOF";
            _ws.LabelFont = Font.CreateDynamicFontFromOSFont(new[] { "NotoSansCJK", "Noto Sans CJK SC", "DroidSansFallback", "PingFang SC", "Arial Unicode MS" }, 48);
            _ws.BindDirect(_model, _scenario, _order[_focusIndex]);
        }

        // Prev/Next/Select map to focus movement — the same session-relative workflow as desktop. Head
        // FOCUS never selects or approves; explicit input does.
        void Update()
        {
            if (Input.GetKeyDown(KeyCode.RightArrow) || Input.GetKeyDown(KeyCode.JoystickButton5)) Move(1);
            else if (Input.GetKeyDown(KeyCode.LeftArrow) || Input.GetKeyDown(KeyCode.JoystickButton4)) Move(-1);
            else if (Input.GetKeyDown(KeyCode.L)) { Zh = !Zh; _ws.SetZh(Zh); }
            else if (Input.GetKeyDown(KeyCode.R)) { _focusIndex = 0; _ws.FocusOn(_order[0]); }
        }
        void Move(int d) { _focusIndex = (_focusIndex + d + _order.Length) % _order.Length; _ws.FocusOn(_order[_focusIndex]); }

        // Exposed for a build/scene tool or a controller adapter to drive without keyboard.
        public void Next() => Move(1);
        public void Prev() => Move(-1);
        public void SetTracking(string t) { if (_ws != null) _ws.SetTracking(t); }
    }
}
#endif
