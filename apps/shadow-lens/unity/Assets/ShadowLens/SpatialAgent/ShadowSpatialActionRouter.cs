// apps/shadow-lens/unity/Assets/ShadowLens/SpatialAgent/ShadowSpatialActionRouter.cs
// Executes a validated action via IShadowSpatialRenderer and returns an HONEST result:
// EXECUTED / REJECTED / TARGET_NOT_FOUND / UNSUPPORTED_BY_CLIENT / RENDER_FAILED. Never a silent
// no-op. Mirrors the tested web SpatialActionExecutor. Pure (interface-driven) → EditMode testable.
// SOURCE AUTHORED · UNITY COMPILE PENDING.
#if UNITY_2020_1_OR_NEWER
using System;
using System.Collections.Generic;

namespace ShadowLens.SpatialAgent
{
    public class ShadowSpatialActionRouter
    {
        readonly IShadowSpatialRenderer _r;
        public ShadowSpatialActionRouter(IShadowSpatialRenderer renderer) { _r = renderer; }

        static readonly Dictionary<string, string> ModeFor = new Dictionary<string, string> {
            { "open_document_mode", "document" }, { "open_source_mode", "source" }, { "open_risk_mode", "risk" },
            { "open_review_mode", "review" }, { "open_audit_mode", "audit" }, { "open_experiment_mode", "experiment" },
            { "open_code_replay_mode", "code" },
        };
        static readonly Dictionary<string, string> WalkFor = new Dictionary<string, string> {
            { "start_audit_walkthrough", "audit" }, { "start_experiment_walkthrough", "experiment" }, { "start_code_walkthrough", "code" },
        };

        public ShadowActionExecutionResult Execute(ShadowActionModel action, IShadowSceneObjectResolver scene)
        {
            var res = new ShadowActionExecutionResult { requested_action = action?.name ?? "?" };
            var v = ShadowSpatialActionValidator.Validate(action, scene);
            res.target_object_id = v.targetId;
            res.validation_status = v.ok ? "valid" : v.code;
            if (!v.ok) { res.execution_status = v.code == "target_not_found" ? ShadowExecStatus.TARGET_NOT_FOUND : ShadowExecStatus.REJECTED; res.error_code = v.error; return res; }

            if (!_r.Supports(action.name)) { res.execution_status = ShadowExecStatus.UNSUPPORTED_BY_CLIENT; res.error_code = "unsupported_by_client"; return res; }

            try
            {
                res.visible_result = Perform(action);
                res.execution_status = res.visible_result ? ShadowExecStatus.EXECUTED : ShadowExecStatus.RENDER_FAILED;
                if (!res.visible_result) res.error_code = "no_visible_change";
            }
            catch (Exception e) { res.execution_status = ShadowExecStatus.RENDER_FAILED; res.error_code = e.Message; }
            return res;
        }

        bool Perform(ShadowActionModel a)
        {
            if (ModeFor.TryGetValue(a.name, out var mode)) return _r.SetMode(mode);
            if (WalkFor.TryGetValue(a.name, out var kind)) return _r.StartWalkthrough(kind);
            switch (a.name)
            {
                case "select_object": return _r.SelectObject(a.args.object_id);
                case "focus_object": return _r.FocusObject(a.args.object_id);
                case "move_camera_to_object": return _r.MoveCameraTo(a.args.object_id);
                case "highlight_source": return _r.Highlight(a.args.source_id);
                case "highlight_claim": return _r.Highlight(a.args.claim_id);
                case "highlight_metric": return _r.Highlight(a.args.object_id);
                case "show_tamper_diff": return _r.ShowTamperDiff();
                case "show_verification_failure": return _r.ShowVerificationFailure();
                case "return_to_workspace": return _r.ReturnToWorkspace();
                case "clear_selection": return _r.ClearSelection();
                default: return false;
            }
        }

        // Execute a list → per-action results + DONE/PARTIAL/FAILED verdict.
        public (List<ShadowActionExecutionResult> records, string verdict) ExecuteAll(ShadowActionModel[] actions, IShadowSceneObjectResolver scene)
        {
            var records = new List<ShadowActionExecutionResult>();
            if (actions != null) foreach (var a in actions) records.Add(Execute(a, scene));
            int executed = 0; foreach (var r in records) if (r.execution_status == ShadowExecStatus.EXECUTED) executed++;
            string verdict = records.Count == 0 ? "DONE" : executed == 0 ? "FAILED" : executed < records.Count ? "PARTIAL" : "DONE";
            return (records, verdict);
        }
    }
}
#endif
