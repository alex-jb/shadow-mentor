// apps/shadow-lens/unity/Assets/ShadowLens/Tests/PlayMode/ShadowAuditArcPlayModeTests.cs
// PlayMode tests for the Slice-E XR visualization: the 3D provenance audit arc, council flat
// labels, and head-directed focus (hover-only, never approves). AUTHORED — run in Unity 6 to
// execute; NOT run on the Node host.
#if UNITY_INCLUDE_TESTS
using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using ShadowLens.Narrative;
using ShadowLens.Spatial;

namespace ShadowLens.Tests.PlayMode
{
    public class ShadowAuditArcPlayModeTests
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

        [Test] public void CouncilVoices_EachGetAUniqueFlatLabel()
        {
            _stage.InvokeNext(); _stage.InvokeNext(); // → COUNCIL
            Assert.AreEqual(5, _stage.VoiceLabelCount, "one flat label per council voice");
            var seen = new System.Collections.Generic.HashSet<string>();
            for (int i = 0; i < _stage.VoiceLabelCount; i++)
            {
                var t = _stage.VoiceLabelText(i);
                Assert.IsNotEmpty(t, "voice label must not be empty");
                Assert.IsTrue(seen.Add(t), "voice labels must be unique: " + t);
            }
        }

        [Test] public void CouncilState_HasExactlyOneDominantVoice()
        {
            _stage.InvokeNext(); _stage.InvokeNext(); // → COUNCIL
            Assert.AreEqual(ShadowNarrativeState.COUNCIL, _stage.State);
            Assert.AreEqual(1, _stage.DominantVoiceIndex); // Risk Officer, the highest-relevance default
        }

        [Test] public void AuditArc_BuildsInFlowOrAudit_WithFullProvenanceSpine()
        {
            Assert.IsFalse(_stage.AuditChainBuilt, "arc must not exist before FLOW_OR_AUDIT");
            _stage.InvokeNext(); _stage.InvokeNext(); _stage.InvokeNext(); _stage.InvokeNext(); // → FLOW_OR_AUDIT
            Assert.IsTrue(_stage.AuditChainBuilt, "arc must build in FLOW_OR_AUDIT");
            Assert.AreEqual(7, _stage.AuditChainNodeCount, "source→snapshot→evidence→claim→recommendation→signature→audit_record");
        }

        [Test] public void AuditArc_HappyPath_AllLinksVerified()
        {
            _stage.InvokeNext(); _stage.InvokeNext(); _stage.InvokeNext(); _stage.InvokeNext();
            // ShadowAuditChainData.BrokenAtSeq < 0 → every link verified
            Assert.AreEqual(_stage.AuditChainNodeCount, _stage.AuditChainVerifiedCount,
                "with no broken link every provenance node renders VERIFIED");
        }

        [Test] public void AuditArc_IsOnlyOne_AndIdempotentAcrossReEntry()
        {
            _stage.InvokeNext(); _stage.InvokeNext(); _stage.InvokeNext(); _stage.InvokeNext(); // FLOW_OR_AUDIT
            _stage.InvokeBack(); _stage.InvokeNext();   // leave and re-enter
            int arcs = 0;
            foreach (var go in Object.FindObjectsByType<GameObject>(FindObjectsSortMode.None)) if (go.name == "AuditChain") arcs++;
            Assert.AreEqual(1, arcs, "the audit arc must be built once, not duplicated on re-entry");
        }

        [Test] public void HeadDirectedFocus_ExistsAndNeverApproves()
        {
            Assert.IsNotNull(_stage.Focus, "the guided stage wires head-directed focus");
            Assert.IsFalse(ShadowHeadDirectedFocus.TriggersApproval, "focus must never approve");
            Assert.AreEqual("HEAD-DIRECTED FOCUS", ShadowHeadDirectedFocus.ModeLabel);
            // an explicit select is highlight-only: it must not change narrative state
            var before = _stage.State;
            _stage.Focus.SelectHovered();
            Assert.AreEqual(before, _stage.State, "focus select must not mutate the decision/narrative");
        }

        [Test] public void Reset_HidesAuditArc_AndReturnsToBankingReady()
        {
            _stage.InvokeNext(); _stage.InvokeNext(); _stage.InvokeNext(); _stage.InvokeNext();
            _stage.ResetDemo();
            Assert.AreEqual(ShadowNarrativeState.READY, _stage.State);
            Assert.AreEqual(0, _stage.VisibleVoiceNodeCount, "voices hidden in READY");
            var arc = GameObject.Find("AuditChain");
            Assert.IsTrue(arc == null || !arc.activeInHierarchy, "audit arc must be hidden in READY");
        }
    }
}
#endif
