// apps/shadow-lens/unity/Assets/ShadowLens/Tests/ShadowNarrativeTests.cs
// EditMode tests for the narrative state machine, the semantic 3D encoding, and the offline Flow
// presenter. Pure (no headset) — run in the Unity Test Runner. Expected numbers cross-checked in Node.
#if UNITY_INCLUDE_TESTS
using NUnit.Framework;
using ShadowLens.Narrative;
using ShadowLens.Flow;
using ShadowLens.Spatial;

namespace ShadowLens.Tests
{
    public class ShadowNarrativeTests
    {
        const float EPS = 1e-3f;

        [Test] public void Next_ProgressesReadyToFlowOrAudit()
        {
            var sm = new ShadowNarrativeStateMachine();
            Assert.AreEqual(ShadowNarrativeState.READY, sm.State);
            sm.Next(); Assert.AreEqual(ShadowNarrativeState.CASE, sm.State);
            sm.Next(); Assert.AreEqual(ShadowNarrativeState.COUNCIL, sm.State);
            sm.Next(); Assert.AreEqual(ShadowNarrativeState.DECISION, sm.State);
            sm.Next(); Assert.AreEqual(ShadowNarrativeState.FLOW_OR_AUDIT, sm.State);
            Assert.IsFalse(sm.CanNext); sm.Next(); // no-op at the end
            Assert.AreEqual(ShadowNarrativeState.FLOW_OR_AUDIT, sm.State);
            Assert.IsTrue(sm.IsFlowOrAudit);
        }

        [Test] public void Back_StepsTowardReady_NeverBelow()
        {
            var sm = new ShadowNarrativeStateMachine();
            sm.GoTo(ShadowNarrativeState.DECISION);
            sm.Back(); Assert.AreEqual(ShadowNarrativeState.COUNCIL, sm.State);
            sm.Back(); sm.Back();
            Assert.AreEqual(ShadowNarrativeState.READY, sm.State);
            Assert.IsFalse(sm.CanBack); sm.Back(); // no-op below READY
            Assert.AreEqual(ShadowNarrativeState.READY, sm.State);
        }

        [Test] public void Reset_ReturnsToReady_FromEveryState()
        {
            foreach (var s in ShadowNarrativeState.Order)
            {
                var sm = new ShadowNarrativeStateMachine();
                sm.GoTo(s);
                sm.Reset();
                Assert.AreEqual(ShadowNarrativeState.READY, sm.State, "Reset must return to READY from " + s);
            }
        }

        [Test] public void Encoding_NodeSize_FloorAndMax()
        {
            Assert.AreEqual(0.06f, ShadowSemanticEncoding.NodeSize(0f), EPS);
            Assert.AreEqual(0.18f, ShadowSemanticEncoding.NodeSize(1f), EPS);
            Assert.AreEqual(0.06f, ShadowSemanticEncoding.NodeSize(-5f), EPS); // clamped
        }

        [Test] public void Encoding_Distance_RelevantIsCloser()
        {
            Assert.AreEqual(0.55f, ShadowSemanticEncoding.DistanceFromCenter(1f), EPS); // most relevant → closest
            Assert.AreEqual(1.2f, ShadowSemanticEncoding.DistanceFromCenter(0f), EPS);   // least → farthest
        }

        [Test] public void Encoding_RiskHeight_AndEdgeColor()
        {
            Assert.AreEqual(0f, ShadowSemanticEncoding.RiskHeight(0f), EPS);
            Assert.AreEqual(0.4f, ShadowSemanticEncoding.RiskHeight(1f), EPS);
            Assert.AreEqual("information", ShadowSemanticEncoding.EdgeColorKey("cites"));
            Assert.AreEqual("tampered", ShadowSemanticEncoding.EdgeColorKey("disagrees"));
            Assert.AreEqual("neutral", ShadowSemanticEncoding.EdgeColorKey("dependency"));
        }

        [Test] public void Encoding_VoicesStayOnOnePlane()
        {
            var center = new V3(0, 0, 0);
            for (int i = 0; i < 5; i++)
            {
                var p = ShadowSemanticEncoding.VoicePosition(i, 5, 0.5f, center, 1.4f);
                Assert.AreEqual(1.4f, p.y, EPS, "council voices must share one plane (height reserved for risk)");
            }
        }

        [Test] public void OfflineFlowPresenter_PreparesWithoutNetwork()
        {
            var h = new ShadowOfflineFlowPresenter().Prepare("case-2026-Q3-0042", "Shadow council");
            Assert.IsTrue(h.prepared);
            Assert.IsFalse(h.networkUsed);
            StringAssert.Contains("launched separately", h.explanation);
        }

        [Test] public void WebApiFlowPresenter_InertUnlessEnabled()
        {
            var off = new ShadowWebApiFlowPresenter(false).Prepare("c", "t");
            Assert.IsFalse(off.prepared);
            Assert.IsFalse(off.networkUsed);
        }
    }
}
#endif
