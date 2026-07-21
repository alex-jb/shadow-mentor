// apps/shadow-lens/unity/Assets/ShadowLens/Tests/PlayMode/ShadowStagePlayModeTests.cs
// PlayMode tests for the guided banking stage: narrative transitions, reset from every state, honesty
// labels, offline Flow (no network), no duplicate panels / stale dominant voice, 3D returns to
// Banking READY after reset. AUTHORED — run in Unity 6 to execute.
#if UNITY_INCLUDE_TESTS
using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using ShadowLens.Narrative;

namespace ShadowLens.Tests.PlayMode
{
    public class ShadowStagePlayModeTests
    {
        ShadowStageController _stage;

        [UnitySetUp] public IEnumerator SetUp()
        {
            if (Camera.main == null) { var cam = new GameObject("cam", typeof(Camera)); cam.tag = "MainCamera"; }
            _stage = Object.FindFirstObjectByType<ShadowStageController>();
            if (_stage == null) _stage = new GameObject("stage").AddComponent<ShadowStageController>();
            yield return null;
            _stage.ResetDemo();
            yield return null;
        }

        [Test] public void Next_WalksAllFiveStates()
        {
            Assert.AreEqual(ShadowNarrativeState.READY, _stage.State);
            _stage.InvokeNext(); Assert.AreEqual(ShadowNarrativeState.CASE, _stage.State);
            _stage.InvokeNext(); Assert.AreEqual(ShadowNarrativeState.COUNCIL, _stage.State);
            _stage.InvokeNext(); Assert.AreEqual(ShadowNarrativeState.DECISION, _stage.State);
            _stage.InvokeNext(); Assert.AreEqual(ShadowNarrativeState.FLOW_OR_AUDIT, _stage.State);
        }

        [Test] public void ResetDemo_FromEveryState_ReturnsToBankingReady()
        {
            foreach (var target in ShadowNarrativeState.Order)
            {
                // walk to target
                _stage.ResetDemo();
                while (_stage.State != target && _stage.State != ShadowNarrativeState.FLOW_OR_AUDIT) _stage.InvokeNext();
                _stage.ResetDemo();
                Assert.AreEqual(ShadowNarrativeState.READY, _stage.State, "reset must return to READY from " + target);
                Assert.AreEqual(0, _stage.VisibleVoiceNodeCount, "voice nodes must be hidden in READY (no stale 3D)");
                Assert.AreEqual(1, _stage.DominantVoiceIndex, "dominant voice must reset (no stale dominant)");
            }
        }

        [Test] public void HonestyLabelsAlwaysVisible()
        {
            Assert.IsTrue(_stage.HonestyLabelsVisible);
            _stage.InvokeNext(); _stage.InvokeNext();
            Assert.IsTrue(_stage.HonestyLabelsVisible, "FIXTURE MODEL + REAL SIGNED must stay visible");
        }

        [Test] public void CouncilState_RevealsFiveVoices_OneDominant()
        {
            _stage.InvokeNext(); _stage.InvokeNext(); // → COUNCIL
            Assert.AreEqual(ShadowNarrativeState.COUNCIL, _stage.State);
            Assert.AreEqual(5, _stage.VisibleVoiceNodeCount);
            StringAssert.Contains("Risk Officer", _stage.CouncilText); // default dominant
        }

        [Test] public void DecisionState_ShowsRecommendationAndSignedStatus()
        {
            _stage.InvokeNext(); _stage.InvokeNext(); _stage.InvokeNext(); // → DECISION
            StringAssert.Contains("REVIEW", _stage.DecisionText);
            StringAssert.Contains("VERIFIED", _stage.DecisionText);
        }

        [UnityTest] public IEnumerator FlowOrAudit_PreparesOffline_NoNetwork()
        {
            _stage.InvokeNext(); _stage.InvokeNext(); _stage.InvokeNext(); _stage.InvokeNext(); // → FLOW_OR_AUDIT
            yield return null;
            Assert.IsTrue(_stage.FlowHandoffPrepared);
            Assert.IsFalse(_stage.FlowNetworkUsed, "Flow handoff must not use the network");
        }

        [Test] public void CaseCore_ShowsBankingIdentity_InReady_VoicesHidden()
        {
            Assert.AreEqual(ShadowNarrativeState.READY, _stage.State);
            StringAssert.Contains("MID-MARKET LOAN", _stage.CaseCoreText);
            StringAssert.Contains("CASE #SL-2026-014", _stage.CaseCoreText);
            StringAssert.Contains("$8.4M REQUEST", _stage.CaseCoreText);
            Assert.AreEqual(0, _stage.VisibleVoiceNodeCount, "council voice nodes must stay hidden in READY");
        }

        [Test] public void ExactlyOneStageControllerAndCanvas()
        {
            Assert.AreEqual(1, Object.FindObjectsByType<ShadowStageController>(FindObjectsSortMode.None).Length);
            int canvases = 0;
            foreach (var c in Object.FindObjectsByType<Canvas>(FindObjectsSortMode.None)) if (c.name == "ShadowStageHUD") canvases++;
            Assert.AreEqual(1, canvases, "no duplicate stage HUD panels");
        }
    }
}
#endif
