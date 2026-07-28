// UX-06 isolation / lifecycle tests. Pin the two production fixes with explicit ownership rather than
// a broad "delete everything" sweep:
//   FIX A — ShadowSpatialAgentPanel.ClearCitations re-parents each chip out before the deferred
//           Destroy, so CitationCount is 0 in the SAME frame a profile switch happens.
//   FIX B — ShadowLensMockView.ShowSource/ShowAudit record the user's top-level action AFTER their
//           internal Analyze(), so LastAction is the user action, not "ANALYZE".
// Also proves the two fixtures survive repeated and cross-fixture execution (both already failed in
// isolation before this increment, so the point here is that the fixes are order-independent).
#if UNITY_INCLUDE_TESTS
using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using ShadowLens.Bootstrap;
using ShadowLens.Mock;

namespace ShadowLens.Tests.PlayMode
{
    public class ShadowPresenterIsolationTests
    {
        ShadowLensRuntimeBootstrap _boot;
        ShadowSpatialAgentPanel _panel;
        ShadowLensMockView _view;

        [UnitySetUp]
        public IEnumerator SetUp()
        {
            _boot = Object.FindFirstObjectByType<ShadowLensRuntimeBootstrap>();
            if (_boot == null) _boot = new GameObject("boot").AddComponent<ShadowLensRuntimeBootstrap>();
            yield return null;
            _boot.useGuidedStage = false;
            _boot.BuildHierarchy();
            yield return null;
            _view = _boot.View;
            _view.SetReady();
            _panel = Object.FindFirstObjectByType<ShadowSpatialAgentPanel>();
            yield return null;
        }

        // ── FIX A: citation clear is synchronous within the frame ───────────────────────────────
        [Test]
        public void ClearingCitations_IsVisibleSameFrame_NoCrossProfileLeak()
        {
            if (_panel == null) Assert.Ignore("spatial-agent panel not present in this scene build");
            _panel.SetProfile("banking-v1");
            _panel.RunQuery("show the source supporting the highest-risk finding");
            Assert.GreaterOrEqual(_panel.CitationCount, 1, "banking query should produce at least one citation");
            _panel.SetProfile("data-science-v1");
            // read in the SAME frame as the profile switch — must already be 0, not end-of-frame
            Assert.AreEqual(0, _panel.CitationCount, "citations must clear synchronously on profile switch (FIX A)");
        }

        [Test]
        public void RepeatedProfileSwitches_NeverAccumulateCitations()
        {
            if (_panel == null) Assert.Ignore("spatial-agent panel not present in this scene build");
            for (int i = 0; i < 4; i++)
            {
                _panel.SetProfile("banking-v1");
                _panel.RunQuery("show the source supporting the highest-risk finding");
                _panel.SetProfile("coding-agent-v1");
                Assert.AreEqual(0, _panel.CitationCount, $"iteration {i}: citations must not survive the switch");
            }
        }

        // ── FIX B: user's top-level action wins over the internal Analyze ───────────────────────
        [Test]
        public void ShowSourceFromReady_RecordsShowSourceNotAnalyze()
        {
            _view.SetReady();
            Assert.AreEqual(MockState.Ready, _view.State);
            _view.ShowSource();
            Assert.AreEqual("SHOW_SOURCE", _view.LastAction, "ShowSource's internal Analyze must not overwrite LastAction (FIX B)");
            Assert.AreEqual(MockState.SourceShown, _view.State);
        }

        [Test]
        public void ShowAuditFromReady_RecordsShowAuditNotAnalyze()
        {
            _view.SetReady();
            _view.ShowAudit();
            Assert.AreEqual("SHOW_AUDIT", _view.LastAction, "ShowAudit's internal Analyze must not overwrite LastAction (FIX B)");
            Assert.AreEqual(MockState.AuditShown, _view.State);
        }

        [Test]
        public void DirectAnalyze_StillRecordsAnalyze()
        {
            // FIX B must not change a directly-invoked Analyze.
            _view.SetReady();
            _view.Analyze();
            Assert.AreEqual("ANALYZE", _view.LastAction);
        }

        // ── ownership: exactly one bootstrap + one Camera.main after setup ──────────────────────
        [Test]
        public void ExactlyOneBootstrapAndOneMainCamera()
        {
            Assert.AreEqual(1, Object.FindObjectsByType<ShadowLensRuntimeBootstrap>(FindObjectsSortMode.None).Length);
            Assert.IsNotNull(Camera.main);
            Assert.AreEqual(1, Camera.allCameras.Length);
        }
    }
}
#endif
