// apps/shadow-lens/unity/Assets/ShadowLens/SpatialAgent/ShadowSpatialQueryController.cs
// Orchestrates the full flow (mirrors the tested web ShadowSpatialApp). Multi-query safe:
//  - starts every query via ShadowSpatialAgentStateMachine.BeginQuery() (terminal → QUERYING),
//    never a raw Go("QUERYING") — so DONE → QUERYING is legal (fixes the illegal-transition bug),
//  - an IsQueryInFlight guard + a monotonically increasing generation id discard stale/duplicate
//    responses, and a try/catch forces FAILED (never leaves the machine half-way),
//  - a per-query transient-clear hook (OnBeginQuery) lets the UI clear the previous answer/
//    citations/LAST ACTION without the controller knowing about UI. Structured logging via Log.
// Never reports an action complete because the server requested it — the router confirms each
// change. SOURCE AUTHORED · compiled in Unity 6.
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
        // Session-scoped query identity: <session_id>:q<sequence>. The authority is an injectable
        // STORE that recovers the last sequence from persisted session state (§1) — NOT a
        // process-global counter — so the sequence continues across profile reconstruction, domain
        // reload, app restart, and session reload (never reuses q1). Default = PlayerPrefs-backed.
        readonly IShadowQuerySequenceStore _seqStore;
        int _gen;               // request generation — a stale/older response is ignored
        bool _inFlight;

        public string LastActionLine { get; private set; } = "LAST ACTION: —";
        public string LastQueryId { get; private set; }   // session-global unique id of the last query
        public string State => _sm.State;
        public bool IsQueryInFlight => _inFlight;

        // hooks (UI wires these; keeps the controller UI-agnostic + engine-independent)
        public Action OnBeginQuery;            // clear per-query transient UI before QUERYING
        public Action<bool> OnControlsEnabled; // enable(true)/disable(false) query controls
        public Action<string> Log = _ => { };  // structured logging (QUERY_START / … )

        public ShadowSpatialQueryController(ShadowSpatialAgentClient client, IShadowSpatialRenderer renderer,
            ShadowSpatialAgentStateMachine sm, IShadowActionStatusView status = null, ShadowActionExecutionReporter reporter = null,
            IShadowQuerySequenceStore seqStore = null)
        {
            _client = client; _router = new ShadowSpatialActionRouter(renderer); _sm = sm; _status = status; _reporter = reporter;
            _seqStore = seqStore ?? new ShadowInMemoryQuerySequenceStore(); // production injects the PlayerPrefs store
            if (status != null) _sm.OnState += status.SetState;
        }

        public void RunQuery(string sessionId, string query, IShadowSceneObjectResolver scene, string currentMode, Action<Outcome> done)
        {
            if (_inFlight) { Log("QUERY_REJECTED_INFLIGHT"); return; } // duplicate submit guard
            string queryId = _seqStore.Issue(sessionId); // <session_id>:q<sequence> — recovered from session state
            LastQueryId = queryId;
            int myGen = ++_gen;
            _inFlight = true;
            OnControlsEnabled?.Invoke(false);
            OnBeginQuery?.Invoke();               // clear previous answer/citations/LAST ACTION/focus
            LastActionLine = "LAST ACTION: —";
            try { _sm.BeginQuery(); } catch (Exception e) { Log("STATE_TRANSITION_REJECTED " + e.Message); _sm.Fail(); Release(myGen); done(Terminal("FAILED")); return; }
            Log("QUERY_START " + queryId);

            _client.Ask(sessionId, query, currentMode, null, (r) =>
            {
                if (myGen != _gen) { Log("QUERY_STALE_RESPONSE_IGNORED " + queryId); return; } // a newer query superseded this
                try
                {
                    if (!r.ok) { _sm.Go(ShadowFlowState.FAILED); Log("QUERY_COMPLETE " + queryId + " FAILED"); Release(myGen); done(Terminal("FAILED")); return; }
                    _sm.Go(ShadowFlowState.ANSWER_RECEIVED);
                    var resp = r.response;
                    if (!resp.grounded)
                    {
                        _sm.Go(ShadowFlowState.UNGROUNDED); Log("QUERY_COMPLETE " + queryId + " UNGROUNDED"); Release(myGen);
                        done(new Outcome { state = _sm.State, response = resp, verdict = "UNGROUNDED", records = new List<ShadowActionExecutionResult>(), lastAction = LastActionLine });
                        return;
                    }
                    _sm.Go(ShadowFlowState.VALIDATING_ACTION);
                    _sm.Go(ShadowFlowState.EXECUTING_ACTION);
                    var (records, verdict) = _router.ExecuteAll(resp.actions, scene);
                    _reporter?.Report(sessionId, queryId, records);
                    if (records.Count > 0) { var last = records[records.Count - 1]; LastActionLine = "LAST ACTION: " + last.requested_action + " — " + last.execution_status; _status?.SetLastAction(LastActionLine); }
                    string finalState = verdict == "DONE" ? ShadowFlowState.DONE : verdict == "PARTIAL" ? ShadowFlowState.PARTIAL : ShadowFlowState.FAILED;
                    _sm.Go(finalState); Log("QUERY_COMPLETE " + queryId + " " + verdict); Release(myGen);
                    done(new Outcome { state = _sm.State, response = resp, verdict = verdict, records = records, lastAction = LastActionLine });
                }
                catch (Exception e)
                {
                    Log("QUERY_FAILED " + queryId + " " + e.Message); _sm.Fail(); Release(myGen);
                    done(Terminal("FAILED"));
                }
            });
        }

        // Profile switch / explicit reset: invalidate any in-flight response + return to READY.
        public void Cancel() { _gen++; _inFlight = false; OnControlsEnabled?.Invoke(true); Log("QUERY_CANCELLED"); }
        public void Reset() { Cancel(); _sm.Reset(); LastActionLine = "LAST ACTION: —"; _status?.SetLastAction(LastActionLine); }

        void Release(int gen) { if (gen == _gen) { _inFlight = false; OnControlsEnabled?.Invoke(true); } }
        Outcome Terminal(string verdict) => new Outcome { state = _sm.State, verdict = verdict, records = new List<ShadowActionExecutionResult>(), lastAction = LastActionLine };
    }
}
#endif
