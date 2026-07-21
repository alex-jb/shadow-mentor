// apps/shadow-lens/unity/Assets/ShadowLens/Tests/PlayMode/ShadowStageBootstrapPlayModeTests.cs
// PlayMode tests for the idempotent guided-stage bootstrap: exactly one stage/HUD/StageWorld,
// deterministic Banking READY, reset creates no new roots, offline Flow (no network), honesty labels.
// AUTHORED — run in Unity 6 to execute.
#if UNITY_INCLUDE_TESTS
using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.TestTools;
using ShadowLens.Bootstrap;
using ShadowLens.Narrative;

namespace ShadowLens.Tests.PlayMode
{
    public class ShadowStageBootstrapPlayModeTests
    {
        ShadowLensRuntimeBootstrap _boot;

        static int Count(string name)
        {
            int n = 0;
            foreach (var go in Object.FindObjectsByType<GameObject>(FindObjectsSortMode.None)) if (go.name == name) n++;
            return n;
        }

        [UnitySetUp] public IEnumerator SetUp()
        {
            if (Camera.main == null) { var c = new GameObject("cam", typeof(Camera)); c.tag = "MainCamera"; }
            _boot = Object.FindFirstObjectByType<ShadowLensRuntimeBootstrap>();
            if (_boot == null) _boot = new GameObject("boot").AddComponent<ShadowLensRuntimeBootstrap>();
            yield return null;
            _boot.useGuidedStage = true;   // this class asserts the guided path
            _boot.BuildHierarchy();
            yield return null;
        }

        [Test] public void GuidedStageActive_ExactlyOneController_ReadyState()
        {
            Assert.IsTrue(_boot.GuidedStageActive, "bootstrap must boot into the guided stage");
            Assert.AreEqual(1, Object.FindObjectsByType<ShadowStageController>(FindObjectsSortMode.None).Length);
            Assert.IsNotNull(_boot.Stage);
            Assert.AreEqual(ShadowNarrativeState.READY, _boot.Stage.State);
        }

        [Test] public void ExactlyOne_StageWorld_Hud_EventSystem()
        {
            Assert.AreEqual(1, Count("StageWorld"), "no duplicate StageWorld");
            Assert.AreEqual(1, Count("ShadowStageHUD"), "no duplicate stage HUD");
            Assert.LessOrEqual(Object.FindObjectsByType<EventSystem>(FindObjectsSortMode.None).Length, 1);
        }

        [Test] public void HonestyLabelsVisible_AfterBootstrapAndReset()
        {
            Assert.IsTrue(_boot.Stage.HonestyLabelsVisible);
            _boot.Stage.ResetDemo();
            Assert.IsTrue(_boot.Stage.HonestyLabelsVisible, "FIXTURE MODEL + REAL SIGNED must stay visible after reset");
        }

        [Test] public void SecondBuildHierarchy_CreatesNoDuplicates()
        {
            int worlds = Count("StageWorld"), huds = Count("ShadowStageHUD"), stages = Object.FindObjectsByType<ShadowStageController>(FindObjectsSortMode.None).Length;
            _boot.BuildHierarchy();   // idempotent
            Assert.AreEqual(worlds, Count("StageWorld"));
            Assert.AreEqual(huds, Count("ShadowStageHUD"));
            Assert.AreEqual(stages, Object.FindObjectsByType<ShadowStageController>(FindObjectsSortMode.None).Length);
        }

        [Test] public void Reset_DoesNotInstantiateNewRoots()
        {
            int worlds = Count("StageWorld"), huds = Count("ShadowStageHUD");
            _boot.Stage.InvokeNext(); _boot.Stage.InvokeNext();
            _boot.Stage.ResetDemo();
            Assert.AreEqual(worlds, Count("StageWorld"), "reset must not create a new StageWorld");
            Assert.AreEqual(huds, Count("ShadowStageHUD"));
            Assert.AreEqual(ShadowNarrativeState.READY, _boot.Stage.State);
        }

        [UnityTest] public IEnumerator OfflineFlow_PreparedWithZeroNetwork()
        {
            _boot.Stage.InvokeNext(); _boot.Stage.InvokeNext(); _boot.Stage.InvokeNext(); _boot.Stage.InvokeNext();
            yield return null;
            Assert.IsTrue(_boot.Stage.FlowHandoffPrepared);
            Assert.IsFalse(_boot.Stage.FlowNetworkUsed, "guided-stage Flow handoff must not use the network");
        }
    }
}
#endif
