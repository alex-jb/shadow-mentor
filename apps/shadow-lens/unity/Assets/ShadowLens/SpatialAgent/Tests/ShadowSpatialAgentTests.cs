// apps/shadow-lens/unity/Assets/ShadowLens/SpatialAgent/Tests/ShadowSpatialAgentTests.cs
// EditMode tests for the Unity spatial-agent protocol + pure logic. AUTHORED — run in Unity 6 to
// execute (mirrors the passing web .ts tests; the Node contract-drift test genuinely runs). Run:
//   Unity -runTests -batchmode -projectPath apps/shadow-lens/unity -testPlatform EditMode
#if UNITY_INCLUDE_TESTS
using System.Collections.Generic;
using NUnit.Framework;
using ShadowLens.SpatialAgent;

namespace ShadowLens.SpatialAgent.Tests
{
    // records what rendered so tests can assert visible execution; can simulate render failure.
    class MockRenderer : IShadowSpatialRenderer
    {
        public string mode = "document", highlighted, selected, walkthrough;
        public HashSet<string> unsupported = new HashSet<string>();
        public bool failHighlight = false;
        public bool SetMode(string m) { mode = m; return true; }
        public bool SelectObject(string id) { selected = id; return true; }
        public bool FocusObject(string id) { selected = id; return true; }
        public bool Highlight(string id) { if (failHighlight) return false; highlighted = id; return true; }
        public bool MoveCameraTo(string id) { return true; }
        public bool StartWalkthrough(string k) { walkthrough = k; return true; }
        public bool ShowTamperDiff() { return true; }
        public bool ShowVerificationFailure() { return true; }
        public bool ReturnToWorkspace() { mode = "document"; selected = null; highlighted = null; return true; }
        public bool ClearSelection() { selected = null; return true; }
        public bool Supports(string a) { return !unsupported.Contains(a); }
    }

    static class Fx
    {
        public static ShadowSpatialSceneIndex Scene()
        {
            var g = new ShadowSceneGraph { objects = new[] {
                new ShadowSceneObject { id = "metric_auc", type = "metric" },
                new ShadowSceneObject { id = "c1", type = "claim" },
            } };
            return new ShadowSpatialSceneIndex(g);
        }
        public static ShadowActionModel A(string name, string argKey = null, string id = null)
        {
            var a = new ShadowActionModel { name = name, args = new ShadowActionArgs() };
            if (argKey == "object_id") a.args.object_id = id; else if (argKey == "source_id") a.args.source_id = id; else if (argKey == "claim_id") a.args.claim_id = id;
            return a;
        }
        public static ShadowSpatialQueryController Controller(MockRenderer r, System.Func<string, ShadowTransportResult> responder)
        {
            var cfg = new ShadowSpatialAgentConfig();
            var transport = new ShadowSpatialAgentMockTransport { Responder = responder };
            var client = new ShadowSpatialAgentClient(cfg, transport);
            return new ShadowSpatialQueryController(client, r, new ShadowSpatialAgentStateMachine());
        }
    }

    public class ShadowSpatialAgentTests
    {
        [Test] public void ContractDeserialization_ParsesGroundedResponse()
        {
            var resp = UnityEngine.JsonUtility.FromJson<ShadowGroundedAnswerModel>(ShadowSpatialAgentMockTransport.Grounded("metric_auc", "AUC 0.912").body);
            Assert.IsTrue(resp.grounded);
            Assert.AreEqual(1, resp.citations.Length);
            Assert.AreEqual("metric_auc", resp.citations[0].source_id);
            Assert.AreEqual(2, resp.actions.Length);
        }

        [Test] public void StateMachine_LegalAndIllegalTransitions()
        {
            var sm = new ShadowSpatialAgentStateMachine();
            Assert.AreEqual(ShadowFlowState.READY, sm.State);
            sm.Go(ShadowFlowState.QUERYING); sm.Go(ShadowFlowState.ANSWER_RECEIVED); sm.Go(ShadowFlowState.UNGROUNDED);
            Assert.Throws<System.InvalidOperationException>(() => sm.Go(ShadowFlowState.EXECUTING_ACTION));
        }

        [Test] public void Validator_UnknownActionAndObjectRejected()
        {
            var scene = Fx.Scene();
            Assert.AreEqual("unknown_action", ShadowSpatialActionValidator.Validate(Fx.A("eval_js"), scene).code);
            Assert.AreEqual("target_not_found", ShadowSpatialActionValidator.Validate(Fx.A("highlight_source", "source_id", "ghost"), scene).code);
            Assert.AreEqual("ok", ShadowSpatialActionValidator.Validate(Fx.A("highlight_source", "source_id", "metric_auc"), scene).code);
        }

        [Test] public void Router_AllFiveStatuses()
        {
            var scene = Fx.Scene(); var r = new MockRenderer();
            var router = new ShadowSpatialActionRouter(r);
            Assert.AreEqual(ShadowExecStatus.REJECTED, router.Execute(Fx.A("eval_js"), scene).execution_status);
            Assert.AreEqual(ShadowExecStatus.TARGET_NOT_FOUND, router.Execute(Fx.A("highlight_source", "source_id", "ghost"), scene).execution_status);
            r.unsupported.Add("open_audit_mode");
            Assert.AreEqual(ShadowExecStatus.UNSUPPORTED_BY_CLIENT, router.Execute(Fx.A("open_audit_mode"), scene).execution_status);
            r.failHighlight = true;
            Assert.AreEqual(ShadowExecStatus.RENDER_FAILED, router.Execute(Fx.A("highlight_source", "source_id", "metric_auc"), scene).execution_status);
            var r2 = new MockRenderer();
            Assert.AreEqual(ShadowExecStatus.EXECUTED, new ShadowSpatialActionRouter(r2).Execute(Fx.A("highlight_source", "source_id", "metric_auc"), scene).execution_status);
        }

        [Test] public void GroundedResponse_ExecutesHighlightAndReachesDone()
        {
            var r = new MockRenderer(); string finalState = null;
            Fx.Controller(r, _ => ShadowSpatialAgentMockTransport.Grounded("metric_auc", "AUC 0.912"))
                .RunQuery("s", "show the source", Fx.Scene(), "document", (o) => finalState = o.state);
            Assert.AreEqual(ShadowFlowState.DONE, finalState);
            Assert.AreEqual("metric_auc", r.highlighted);
        }

        [Test] public void UngroundedResponse_ExecutesNoAction()
        {
            var r = new MockRenderer(); ShadowSpatialQueryController.Outcome outc = default;
            Fx.Controller(r, _ => ShadowSpatialAgentMockTransport.Ungrounded())
                .RunQuery("s", "meaning of life", Fx.Scene(), "document", (o) => outc = o);
            Assert.AreEqual(ShadowFlowState.UNGROUNDED, outc.state);
            Assert.AreEqual(0, outc.records.Count);
            Assert.IsNull(r.highlighted);
        }

        [Test] public void MalformedResponse_Fails()
        {
            string s = null;
            Fx.Controller(new MockRenderer(), _ => ShadowSpatialAgentMockTransport.Malformed())
                .RunQuery("s", "verify", Fx.Scene(), "document", (o) => s = o.state);
            Assert.AreEqual(ShadowFlowState.FAILED, s);
        }

        [Test] public void BackendUnavailable_Fails()
        {
            string s = null;
            Fx.Controller(new MockRenderer(), _ => ShadowSpatialAgentMockTransport.Unavailable())
                .RunQuery("s", "verify", Fx.Scene(), "document", (o) => s = o.state);
            Assert.AreEqual(ShadowFlowState.FAILED, s);
        }

        [Test] public void PartialMultiAction_Verdict()
        {
            var scene = Fx.Scene(); var r = new MockRenderer();
            var router = new ShadowSpatialActionRouter(r);
            var actions = new[] { Fx.A("highlight_source", "source_id", "metric_auc"), Fx.A("highlight_source", "source_id", "ghost") };
            var (records, verdict) = router.ExecuteAll(actions, scene);
            Assert.AreEqual("PARTIAL", verdict);
            Assert.AreEqual(2, records.Count);
        }

        [Test] public void ExecutionConfirmation_MaterialOnly()
        {
            var rep = new ShadowActionExecutionReporter { Now = () => 42 };
            var recs = new List<ShadowActionExecutionResult> {
                new ShadowActionExecutionResult { requested_action = "highlight_source", execution_status = ShadowExecStatus.EXECUTED },
                new ShadowActionExecutionResult { requested_action = "?", execution_status = ShadowExecStatus.EXECUTED },
            };
            var ev = rep.Build("s", "q1", recs);
            Assert.AreEqual(1, ev.Count);
            Assert.AreEqual(42, ev[0].timestamp);
        }

        [Test] public void ScreenshotOffByDefault()
        {
            var cfg = new ShadowSpatialAgentConfig();
            Assert.IsFalse(cfg.ScreenshotEnabled);
        }

        [Test] public void Reset_ReturnsReady()
        {
            var r = new MockRenderer();
            var ctrl = Fx.Controller(r, _ => ShadowSpatialAgentMockTransport.Grounded("metric_auc", "x"));
            ctrl.RunQuery("s", "show source", Fx.Scene(), "document", (_) => {});
            ctrl.Reset();
            Assert.AreEqual(ShadowFlowState.READY, ctrl.State);
        }

        // ── multi-query lifecycle (the DONE -> QUERYING bug) ──
        [Test] public void BeginQuery_LegalFromEveryTerminalState()
        {
            foreach (var terminal in new[] { ShadowFlowState.DONE, ShadowFlowState.PARTIAL, ShadowFlowState.FAILED, ShadowFlowState.UNGROUNDED })
            {
                var sm = new ShadowSpatialAgentStateMachine();
                sm.Go(ShadowFlowState.QUERYING);
                if (terminal == ShadowFlowState.UNGROUNDED) { sm.Go(ShadowFlowState.ANSWER_RECEIVED); sm.Go(ShadowFlowState.UNGROUNDED); }
                else { sm.Go(ShadowFlowState.ANSWER_RECEIVED); sm.Go(ShadowFlowState.VALIDATING_ACTION); sm.Go(ShadowFlowState.EXECUTING_ACTION); sm.Go(terminal); }
                Assert.AreEqual(terminal, sm.State);
                Assert.DoesNotThrow(() => sm.BeginQuery());   // terminal -> QUERYING is legal
                Assert.AreEqual(ShadowFlowState.QUERYING, sm.State);
            }
        }

        [Test] public void BeginQuery_RejectedFromNonTerminal()
        {
            var sm = new ShadowSpatialAgentStateMachine();
            sm.BeginQuery(); // READY -> QUERYING
            Assert.Throws<System.InvalidOperationException>(() => sm.BeginQuery()); // QUERYING is not terminal
        }

        [Test] public void Fail_ForcesFailedFromAnyState()
        {
            var sm = new ShadowSpatialAgentStateMachine();
            sm.BeginQuery(); sm.Go(ShadowFlowState.ANSWER_RECEIVED);
            Assert.DoesNotThrow(() => sm.Fail());
            Assert.AreEqual(ShadowFlowState.FAILED, sm.State);
        }

        [Test] public void TwoConsecutiveQueries_DoneThenDone_NoIllegalTransition()
        {
            var r = new MockRenderer();
            var ctrl = Fx.Controller(r, _ => ShadowSpatialAgentMockTransport.Grounded("metric_auc", "AUC"));
            string s1 = null, s2 = null;
            ctrl.RunQuery("s", "show source", Fx.Scene(), "document", (o) => s1 = o.state);
            Assert.AreEqual(ShadowFlowState.DONE, s1);
            Assert.DoesNotThrow(() => ctrl.RunQuery("s", "show source again", Fx.Scene(), "document", (o) => s2 = o.state));
            Assert.AreEqual(ShadowFlowState.DONE, s2); // DONE -> QUERYING -> ... -> DONE, no exception
        }

        [Test] public void QueryId_IsSessionScoped_AndUniqueAcrossProfileSwitch()
        {
            // query_id is <session_id>:q<sequence> — bound to the signed session, unique across
            // profile switches (different session_id), incrementing within one session.
            var bank1 = Fx.Controller(new MockRenderer(), _ => ShadowSpatialAgentMockTransport.Grounded("metric_auc", "x"));
            bank1.RunQuery("banking-v1-demo", "q", Fx.Scene(), "document", (_) => {});
            StringAssert.StartsWith("banking-v1-demo:q", bank1.LastQueryId);

            // profile switch → new controller, different session_id → different prefix
            var ds = Fx.Controller(new MockRenderer(), _ => ShadowSpatialAgentMockTransport.Grounded("metric_auc", "x"));
            ds.RunQuery("data-science-v1-demo", "q", Fx.Scene(), "document", (_) => {});
            StringAssert.StartsWith("data-science-v1-demo:q", ds.LastQueryId);
            Assert.AreNotEqual(bank1.LastQueryId, ds.LastQueryId);

            // returning to the same session_id keeps incrementing (no q1 reuse)
            var bank2 = Fx.Controller(new MockRenderer(), _ => ShadowSpatialAgentMockTransport.Grounded("metric_auc", "x"));
            bank2.RunQuery("banking-v1-demo", "q", Fx.Scene(), "document", (_) => {});
            Assert.AreNotEqual(bank1.LastQueryId, bank2.LastQueryId, "sequence must not reuse within a session");
        }

        [Test] public void FailedThenRetry_Works()
        {
            var r = new MockRenderer();
            bool first = true;
            var ctrl = Fx.Controller(r, _ => { if (first) { first = false; return ShadowSpatialAgentMockTransport.Unavailable(); } return ShadowSpatialAgentMockTransport.Grounded("metric_auc", "AUC"); });
            string s1 = null, s2 = null;
            ctrl.RunQuery("s", "show source", Fx.Scene(), "document", (o) => s1 = o.state);
            Assert.AreEqual(ShadowFlowState.FAILED, s1);
            ctrl.RunQuery("s", "retry", Fx.Scene(), "document", (o) => s2 = o.state); // FAILED -> QUERYING legal
            Assert.AreEqual(ShadowFlowState.DONE, s2);
        }
    }
}
#endif
