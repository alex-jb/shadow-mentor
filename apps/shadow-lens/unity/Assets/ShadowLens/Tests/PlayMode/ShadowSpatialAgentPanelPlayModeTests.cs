// apps/shadow-lens/unity/Assets/ShadowLens/Tests/PlayMode/ShadowSpatialAgentPanelPlayModeTests.cs
// Gate 2 PlayMode tests: the wired spatial-agent panel produces visible, grounded results across
// the three profiles, and the existing Analyze/Verify/Source/Audit/Tamper/Reset behavior is
// preserved. AUTHORED — run in Unity 6 to execute.
#if UNITY_INCLUDE_TESTS
using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using ShadowLens.Bootstrap;
using ShadowLens.Mock;

namespace ShadowLens.Tests.PlayMode
{
    public class ShadowSpatialAgentPanelPlayModeTests
    {
        ShadowLensRuntimeBootstrap _boot;
        ShadowSpatialAgentPanel _panel;
        ShadowLensMockView _view;

        [UnitySetUp] public IEnumerator SetUp()
        {
            _boot = Object.FindFirstObjectByType<ShadowLensRuntimeBootstrap>();
            if (_boot == null) _boot = new GameObject("boot").AddComponent<ShadowLensRuntimeBootstrap>();
            yield return null;
            _panel = _boot.SpatialPanel; _view = _boot.View;
            Assert.IsNotNull(_panel, "spatial panel must be built by the bootstrap");
            _panel.SetProfile("banking-v1"); _view.SetReady();
            yield return null;
        }

        [Test] public void ExactlyOnePanel() =>
            Assert.AreEqual(1, Object.FindObjectsByType<ShadowSpatialAgentPanel>(FindObjectsSortMode.None).Length);

        [Test] public void Banking_GroundedAnswerCard_CitationsAndVisibleSource()
        {
            _panel.RunQuery("show the source supporting the highest-risk finding");
            StringAssert.Contains("DTI", _panel.AnswerText);
            Assert.AreEqual("GROUNDED", _panel.GroundedText);
            Assert.GreaterOrEqual(_panel.CitationCount, 1);
            StringAssert.Contains("EXECUTED", _panel.LastActionText);
            Assert.IsTrue(_view.SourceOverlayActive, "banking source highlight must reuse the visible Source overlay");
        }

        [Test] public void DataScience_ModelFocusVisible()
        {
            _panel.SetProfile("data-science-v1");
            _panel.RunQuery("why was this model selected?");
            Assert.AreEqual("GROUNDED", _panel.GroundedText);
            StringAssert.Contains("selection", _panel.FocusText); // focus_object selection surfaced visibly
        }

        [Test] public void Coding_DiffFocusVisible()
        {
            _panel.SetProfile("coding-agent-v1");
            _panel.RunQuery("which change fixed the duplicate EventSystem?");
            Assert.AreEqual("GROUNDED", _panel.GroundedText);
            StringAssert.Contains("diff1", _panel.FocusText);
        }

        [Test] public void Ungrounded_NoAction()
        {
            _panel.RunQuery("what is the meaning of life");
            Assert.AreEqual("UNGROUNDED", _panel.GroundedText);
            Assert.AreEqual("", _panel.FocusText);
        }

        [Test] public void Verify_ShowsRealVerificationState()
        {
            _panel.RunQuery("verify this record");
            StringAssert.Contains("verified", _panel.AnswerText.ToLower());
        }

        // ── preservation of the existing behavior ──
        [Test] public void Existing_AnalyzeAndVerifyStillWork()
        {
            _view.Analyze();
            Assert.AreEqual(MockState.Analyzed, _view.State);
            _view.Verify();
            Assert.AreEqual(MockState.Verified, _view.State);
        }

        [Test] public void Existing_ShowSourceAndAuditStillWork()
        {
            _view.ShowSource(); Assert.IsTrue(_view.SourceOverlayActive);
            _view.ShowAudit(); Assert.AreEqual(7, _view.ActiveAuditNodeCount);
        }

        [Test] public void Existing_ResetRestoresDefault()
        {
            _panel.RunQuery("show the source supporting the highest-risk finding");
            _view.ResetView();
            Assert.AreEqual(MockState.Ready, _view.State);
            Assert.IsFalse(_view.SourceOverlayActive);
        }
    }
}
#endif
