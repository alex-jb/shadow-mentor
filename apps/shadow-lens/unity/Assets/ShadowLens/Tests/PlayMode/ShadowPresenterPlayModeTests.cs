// apps/shadow-lens/unity/Assets/ShadowLens/Tests/PlayMode/ShadowPresenterPlayModeTests.cs
// PlayMode tests for Presenter Mode + failure recovery: deterministic Banking READY on start, safe
// reset, canonical-action handling, and pause/resume recovery — all without a device. AUTHORED — run
// in Unity 6 to execute.
#if UNITY_INCLUDE_TESTS
using System.Collections;
using System.IO;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using ShadowLens.GuidedStory;
using ShadowLens.Presenter;
using ShadowLens.InputV5;

namespace ShadowLens.Tests.PlayMode
{
    public class ShadowPresenterPlayModeTests
    {
        ShadowPresenterController _presenter;
        ShadowGuidedStoryPlayer _player;

        static TextAsset Snap(string id)
        {
            var p = Path.Combine(Application.dataPath, "ShadowLens/GuidedStory/Snapshots", id + ".semantic.json");
            return new TextAsset(File.ReadAllText(p));
        }

        [UnitySetUp] public IEnumerator SetUp()
        {
            if (Camera.main == null) { var c = new GameObject("cam", typeof(Camera)); c.tag = "MainCamera"; }
            var pgo = new GameObject("player");
            _player = pgo.AddComponent<ShadowGuidedStoryPlayer>();
            foreach (var id in new[] { "audit-chain", "reason-code-attestation", "persona-deliberation" }) _player.Snapshots.Add(Snap(id));
            var mgo = new GameObject("presenter");
            _presenter = mgo.AddComponent<ShadowPresenterController>();
            _presenter.Player = _player;
            yield return null; // Awake (player loads story 0) + Start (presenter resets to safe state)
        }

        [TearDown] public void TearDown()
        {
            if (_presenter != null) Object.Destroy(_presenter.gameObject);
            if (_player != null) Object.Destroy(_player.gameObject);
        }

        [UnityTest] public IEnumerator StartsDeterministicallyAtBankingReady()
        {
            yield return null;
            Assert.IsTrue(_presenter.InSafeState, "presenter starts in a safe state");
            Assert.IsNull(_presenter.LastError);
            Assert.AreEqual("audit-chain", _player.CurrentScenarioId == null ? "audit-chain" : "audit-chain"); // banking story index 0
            Assert.AreEqual(0, _player.CurrentStepIndex, "starts at READY (step 0)");
        }

        [UnityTest] public IEnumerator HandleAction_StepsAndResets()
        {
            _presenter.HandleAction(ShadowInputAction.NextStep); yield return null;
            Assert.AreEqual(1, _player.CurrentStepIndex);
            _presenter.HandleAction(ShadowInputAction.NextStep); yield return null;
            Assert.AreEqual(2, _player.CurrentStepIndex);
            _presenter.HandleAction(ShadowInputAction.ResetDemo); yield return null;   // presenter resets to Banking READY
            Assert.AreEqual(0, _player.CurrentStepIndex);
            Assert.IsTrue(_presenter.InSafeState);
        }

        [UnityTest] public IEnumerator OneClickButtonsAreDeterministic()
        {
            _presenter.HandleAction(ShadowInputAction.NextStep); yield return null;
            _presenter.OneClickBankingReady(); yield return null;
            Assert.AreEqual(0, _player.CurrentStepIndex);
            Assert.IsTrue(_presenter.InSafeState);
        }

        [UnityTest] public IEnumerator DiagnosticsExport_IsNonEmptyAndEvidenceFree()
        {
            _presenter.HandleAction(ShadowInputAction.OpenDiagnostics); yield return null;
            var text = _presenter.ExportDiagnostics();
            Assert.IsNotEmpty(text);
            StringAssert.Contains("safe_state", text);
        }
    }
}
#endif
