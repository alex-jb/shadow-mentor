// apps/shadow-lens/unity/Assets/ShadowLens/Tests/PlayMode/ShadowLensPlayModeTests.cs
// PlayMode smoke tests for the mock scene: singletons, visible render, front-of-camera
// document, deterministic Ready→Analyze→Reset state, no duplicate roots. AUTHORED — run these
// in Unity 6 to verify (the project compiled + entered Play Mode on 2026-07-20; these updated
// tests are not yet executed by Alex). Run:
//   Unity -runTests -batchmode -projectPath apps/shadow-lens/unity \
//     -testPlatform PlayMode -testResults playmode-results.xml -logFile -
#if UNITY_INCLUDE_TESTS
using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using UnityEngine.TestTools;
using ShadowLens.Bootstrap;
using ShadowLens.Mock;

namespace ShadowLens.Tests.PlayMode
{
    public class ShadowLensPlayModeTests
    {
        ShadowLensRuntimeBootstrap _boot;

        [UnitySetUp]
        public IEnumerator SetUp()
        {
            // AutoBoot creates one on scene load; ensure exactly one, then grab it.
            _boot = Object.FindFirstObjectByType<ShadowLensRuntimeBootstrap>();
            if (_boot == null) _boot = new GameObject("boot").AddComponent<ShadowLensRuntimeBootstrap>();
            yield return null; // let Awake/Build run
            _boot.View.SetReady();
            yield return null;
        }

        [Test] public void ExactlyOneEventSystem() =>
            Assert.AreEqual(1, Object.FindObjectsByType<EventSystem>(FindObjectsSortMode.None).Length);

        [Test] public void ExactlyOneBootstrap() =>
            Assert.AreEqual(1, Object.FindObjectsByType<ShadowLensRuntimeBootstrap>(FindObjectsSortMode.None).Length);

        [Test] public void ExactlyOneActiveMainCamera()
        {
            Assert.IsNotNull(Camera.main);
            Assert.AreEqual(1, Camera.allCameras.Length);
        }

        [Test] public void NoDuplicateGeneratedRoots()
        {
            int roots = 0;
            foreach (var go in Object.FindObjectsByType<GameObject>(FindObjectsSortMode.None))
                if (go.name == ShadowLensRuntimeBootstrap.RootName) roots++;
            Assert.AreEqual(1, roots);
        }

        [Test] public void AtLeastOneVisibleCanvasOrRenderer()
        {
            int canvases = Object.FindObjectsByType<Canvas>(FindObjectsSortMode.None).Length;
            int graphics = Object.FindObjectsByType<Graphic>(FindObjectsSortMode.None).Length; // Text/Image render
            Assert.Greater(canvases, 0, "no Canvas → nothing renders");
            Assert.Greater(graphics, 0, "no UI graphics → empty scene");
        }

        [Test] public void DocumentPlaneIsInFrontOfCamera()
        {
            var doc = GameObject.Find("FrozenDocumentPlane");
            Assert.IsNotNull(doc, "FrozenDocumentPlane missing");
            var cam = Camera.main;
            float dot = Vector3.Dot((doc.transform.position - cam.transform.position).normalized, cam.transform.forward);
            Assert.Greater(dot, 0f, "document is not in front of the camera");
        }

        [Test] public void DecisionPanelPopulatesInView()
        {
            _boot.View.Analyze();
            var decision = FindText("DECISION");
            Assert.IsNotNull(decision);
            Assert.IsNotEmpty(decision.text, "Analyze must populate a visible decision");
        }

        [Test] public void MockReachesReady() => Assert.AreEqual(MockState.Ready, _boot.View.State);

        [Test] public void AnalyzeCausesVisibleStateChange()
        {
            var status = FindText("STATUS");
            string before = status.text;
            _boot.View.Analyze();
            Assert.AreEqual(MockState.Analyzed, _boot.View.State);
            Assert.AreNotEqual(before, status.text, "status text must change on Analyze");
        }

        [Test] public void ResetReturnsToReady()
        {
            _boot.View.Analyze();
            _boot.View.ResetView();
            Assert.AreEqual(MockState.Ready, _boot.View.State);
        }

        static Text FindText(string name)
        {
            foreach (var t in Object.FindObjectsByType<Text>(FindObjectsSortMode.None))
                if (t.gameObject.name == name) return t;
            return null;
        }
    }
}
#endif
