// apps/shadow-lens/unity/Assets/ShadowLens/SpatialAgent/ShadowSpatialQueryController.cs
// Orchestrates the full flow (mirrors the tested web ShadowSpatialApp): ask → state machine →
// validate+execute each action via the router → report → DONE/PARTIAL/FAILED/UNGROUNDED. Never
// reports an action complete because the server requested it — the router confirms each change.
// SOURCE AUTHORED · UNITY COMPILE PENDING · VISUAL WIRING PENDING (Gate 2).
#if UNITY_2020_1_OR_NEWER
using System;
using System.Collections.Generic;

namespace ShadowLens.SpatialAgent
{
    public class ShadowSpatialQueryController
    {
        public struct Outcome { public string state; public ShadowGroundedAnswerModel response; public List<ShadowActionExecutionResult> records; public string verdict; public string lastAction; }

        readonly ShadowSpatialAgentClient _client;
        readonly ShadowSpatialActionRouter _router;
        readonly ShadowSpatialAgentStateMachine _sm;
        readonly IShadowActionStatusView _status;
        readonly ShadowActionExecutionReporter _reporter;
        int _queryCounter;
        public string LastActionLine { get; private set; } = "LAST ACTION: —";
        public string State => _sm.State;

        public ShadowSpatialQueryController(ShadowSpatialAgentClient client, IShadowSpatialRenderer renderer,
            ShadowSpatialAgentStateMachine sm, IShadowActionStatusView status = null, ShadowActionExecutionReporter reporter = null)
        {
            _client = client; _router = new ShadowSpatialActionRouter(renderer); _sm = sm; _status = status; _reporter = reporter;
            if (status != null) _sm.OnState += status.SetState;
        }

        public void RunQuery(string sessionId, string query, IShadowSceneObjectResolver scene, string currentMode, Action<Outcome> done)
        {
            string queryId = "q" + (++_queryCounter);
            _sm.Go(ShadowFlowState.QUERYING);
            _client.Ask(sessionId, query, currentMode, null, (r) =>
            {
                if (!r.ok) { _sm.Go(ShadowFlowState.FAILED); done(new Outcome { state = _sm.State, verdict = "FAILED", records = new List<ShadowActionExecutionResult>(), lastAction = LastActionLine }); return; }
                _sm.Go(ShadowFlowState.ANSWER_RECEIVED);
                var resp = r.response;
                if (!resp.grounded)
                {
                    _sm.Go(ShadowFlowState.UNGROUNDED);
                    done(new Outcome { state = _sm.State, response = resp, verdict = "UNGROUNDED", records = new List<ShadowActionExecutionResult>(), lastAction = LastActionLine });
                    return;
                }
                _sm.Go(ShadowFlowState.VALIDATING_ACTION);
                _sm.Go(ShadowFlowState.EXECUTING_ACTION);
                var (records, verdict) = _router.ExecuteAll(resp.actions, scene);
                _reporter?.Report(sessionId, queryId, records);
                if (records.Count > 0) { var last = records[records.Count - 1]; LastActionLine = "LAST ACTION: " + last.requested_action + " — " + last.execution_status; _status?.SetLastAction(LastActionLine); }
                string finalState = verdict == "DONE" ? ShadowFlowState.DONE : verdict == "PARTIAL" ? ShadowFlowState.PARTIAL : ShadowFlowState.FAILED;
                _sm.Go(finalState);
                done(new Outcome { state = _sm.State, response = resp, verdict = verdict, records = records, lastAction = LastActionLine });
            });
        }

        public void Reset() { _sm.Reset(); LastActionLine = "LAST ACTION: —"; _status?.SetLastAction(LastActionLine); }
    }
}
#endif
