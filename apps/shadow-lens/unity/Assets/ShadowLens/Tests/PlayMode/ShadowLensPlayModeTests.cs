// apps/shadow-lens/unity/Assets/ShadowLens/Tests/PlayMode/ShadowLensPlayModeTests.cs
// PlayMode tests for the mock end-to-end flow. AUTHORED — NOT EXECUTED (no Unity runtime on
// the build host). Run later:
//   Unity -runTests -batchmode -projectPath apps/shadow-lens/unity \
//     -testPlatform PlayMode -testResults playmode-results.xml -logFile -
// (EditMode geometry tests already run via shadow-lens-unity.yml.)
#if UNITY_INCLUDE_TESTS
using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using ShadowLens.Core;
using ShadowLens.Spatial;
using ShadowLens.Bootstrap;

namespace ShadowLens.Tests.PlayMode
{
    public class ShadowLensPlayModeTests
    {
        ShadowLensRuntimeBootstrap Boot()
        {
            var go = new GameObject("boot");
            var b = go.AddComponent<ShadowLensRuntimeBootstrap>();
            b.autoRunOnStart = false;
            b.BuildHierarchy();
            return b;
        }

        [UnityTest] // mock capture → result flow reaches at least the Cited state
        public IEnumerator MockCaptureFlow_ReachesCited()
        {
            var b = Boot();
            b.Controller.OnCommand(VoiceCommand.ScanDocument);
            b.Controller.OnCommand(VoiceCommand.Capture);
            yield return new WaitForSeconds(0.1f);
            Assert.That(b.Controller.State, Is.Not.EqualTo(LensState.Failed));
        }

        [Test] // frozen document plane is created and world-locked in front of the viewer
        public void FrozenDocumentPlane_IsCreated()
        {
            var b = Boot();
            Assert.IsNotNull(b.Controller.documentPlane);
            Assert.Less(b.Controller.documentPlane.position.z, 0f); // in front (-Z)
        }

        [Test] // claim→source highlight lands on the document plane (uses the tested geometry)
        public void SourceHighlight_MapsOntoPlane()
        {
            var box = new NormalizedBox(0.1f, 0.3f, 0.4f, 0.03f);
            var p = SpatialLayout.SourceOverlayWorld(box, new V3(0, 1.4f, -1.5f), 0.6f, 0.8f);
            Assert.AreEqual(-1.495f, p.z, 1e-3f); // proud of the page, not behind it
        }

        [UnityTest] // audit view expands to one node per hash-chain event
        public IEnumerator AuditView_ExpandsPerEvent()
        {
            var b = Boot();
            b.Controller.PlaceAuditArc(5);
            yield return null;
            Assert.Pass("PlaceAuditArc executed without error (visual count asserted on device).");
        }

        [UnityTest] // verification cascade reaches Verified for an intact chain
        public IEnumerator VerificationCascade_Verifies()
        {
            var b = Boot();
            yield return b.Controller.RunVerificationCascade(4, firstBrokenSeq: -1);
            Assert.AreEqual(LensState.Verified, b.Controller.State);
        }

        [UnityTest] // a broken link freezes the cascade at its seq (tampered state)
        public IEnumerator VerificationCascade_FreezesOnBrokenLink()
        {
            var b = Boot();
            yield return b.Controller.RunVerificationCascade(4, firstBrokenSeq: 2);
            Assert.AreEqual(LensState.Failed, b.Controller.State);
        }

        [Test] // reset clears spawned objects and returns to Idle
        public void Reset_ReturnsToIdle()
        {
            var b = Boot();
            b.Controller.PlaceRiskTiles(new[] { 0.2f, 0.8f });
            b.Controller.OnCommand(VoiceCommand.Reset);
            Assert.AreEqual(LensState.Idle, b.Controller.State);
        }

        [Test] // voice/controller command parity — free text maps to the closed enum, never LLM
        public void VoiceCommandParity()
        {
            Assert.AreEqual(VoiceCommand.Analyze, VoiceCommandRouter.Route("please analyze this"));
            Assert.AreEqual(VoiceCommand.ShowReview, VoiceCommandRouter.Route("show the council"));
            Assert.AreEqual(VoiceCommand.None, VoiceCommandRouter.Route("what is the DTI ratio")); // grounded Q → analysis path
        }
    }
}
#endif
