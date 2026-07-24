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
            // These tests exercise the LEGACY MockView/panel; force that path (the runtime default is
            // now the guided stage). BuildHierarchy is idempotent.
            _boot.useGuidedStage = false;
            _boot.BuildHierarchy();
            yield return null;
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
            // The FINDING renders inside the document footer, which lives in the source overlay
            // (ShadowLensMockView: _decision = null; the finding is built into the SourceOverlay group,
            // inactive until ShowSource). Analyze reaches Analyzed; ShowSource surfaces the finding.
            _boot.View.Analyze();
            Assert.AreEqual(MockState.Analyzed, _boot.View.State, "Analyze must reach the Analyzed state");
            _boot.View.ShowSource();
            var finding = FindText("FindingText");
            Assert.IsNotNull(finding, "ShowSource must surface the document-footer finding");
            Assert.IsNotEmpty(finding.text);
        }

        [Test] public void MockReachesReady() => Assert.AreEqual(MockState.Ready, _boot.View.State);

        [Test] public void AnalyzeCausesVisibleStateChange()
        {
            // No top STATUS label exists (ShadowLensMockView: _status = null; the spatial-agent panel
            // owns the single status row). Analyze's observable change in the legacy mock view is the
            // state transition Ready -> Analyzed.
            Assert.AreEqual(MockState.Ready, _boot.View.State, "SetUp leaves the view Ready");
            _boot.View.Analyze();
            Assert.AreEqual(MockState.Analyzed, _boot.View.State, "Analyze must move the view to Analyzed");
        }

        [Test] public void ResetReturnsToReady()
        {
            _boot.View.Analyze();
            _boot.View.ResetView();
            Assert.AreEqual(MockState.Ready, _boot.View.State);
        }

        // ── button-interaction path (the reported Show Source / Show Audit failures) ──
        [Test] public void ShowSource_CreatesVisibleOverlay()
        {
            _boot.View.ShowSource();
            Assert.IsTrue(_boot.View.SourceOverlayActive, "source overlay must be active");
            var g = _boot.View.SourceOverlayTransform.GetComponentInChildren<Graphic>(true);
            Assert.IsNotNull(g, "source overlay must contain a renderable Graphic");
            Assert.IsTrue(g.enabled, "source overlay renderer must be enabled");
            Assert.AreEqual("SHOW_SOURCE", _boot.View.LastAction);
        }

        [Test] public void ShowSource_OverlayInFrustum()
        {
            _boot.View.ShowSource();
            Assert.IsTrue(_boot.View.InFrustum(_boot.View.SourceOverlayTransform), "source overlay must be inside the camera frustum");
        }

        [Test] public void ShowAudit_CreatesVisibleNodes()
        {
            _boot.View.ShowAudit();
            Assert.IsTrue(_boot.View.AuditRootActive, "AuditArcRoot must be active");
            Assert.AreEqual(7, _boot.View.ActiveAuditNodeCount, "audit arc must render 7 stage nodes");
        }

        [Test] public void ShowAudit_ArcInFrustum()
        {
            _boot.View.ShowAudit();
            Assert.IsTrue(_boot.View.InFrustum(_boot.View.AuditRootTransform), "audit arc must be inside the camera frustum");
        }

        [Test] public void Tamper_ChangesVerifiedToTampered()
        {
            _boot.View.Analyze(); _boot.View.Verify();
            Assert.AreEqual(MockState.Verified, _boot.View.State);
            _boot.View.Tamper();
            Assert.AreEqual(MockState.Tampered, _boot.View.State);
            Assert.IsTrue(FindText("TRUST").text.ToUpper().Contains("TAMPERED"));
        }

        [Test] public void Reset_ReturnsToReadyAndUnsigned()
        {
            // No top STATUS label (ShadowLensMockView: _status = null). Ready + UNSIGNED trust is the
            // full observable reset contract; the removed STATUS assertion is dropped.
            _boot.View.Analyze(); _boot.View.Verify();
            _boot.View.ResetView();
            Assert.AreEqual(MockState.Ready, _boot.View.State);
            Assert.AreEqual("UNSIGNED", FindText("TRUST").text);
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
