// apps/shadow-lens/unity/Assets/ShadowLens/Tests/GuidedStory/ShadowGuidedStoryEditTests.cs
// EditMode tests for the guided-story Unity adapter: the mini JSON parser (incl. fail-closed on
// proto keys / oversize), the fail-closed loader, the vocabulary mirror, the pure layout adapter,
// and the step state machine. Pure (no headset). Cross-checked against the Node compiler's numbers.
// SOURCE AUTHORED — these are authored EditMode tests; run under Unity Test Runner to turn them green.
#if UNITY_INCLUDE_TESTS
using System.IO;
using NUnit.Framework;
using UnityEngine;
using ShadowLens.GuidedStory;

namespace ShadowLens.Tests
{
    public class ShadowGuidedStoryEditTests
    {
        static readonly string[] StoryIds = { "audit-chain", "reason-code-attestation", "persona-deliberation" };
        static string SnapshotPath(string id) => Path.Combine(Application.dataPath, "ShadowLens/GuidedStory/Snapshots", id + ".semantic.json");
        static GuidedStorySemantic Load(string id) => ShadowGuidedStoryLoader.Load(File.ReadAllText(SnapshotPath(id)));

        [Test] public void Json_ParsesObjectsArraysAndScalars()
        {
            var v = ShadowGuidedStoryJson.Parse("{\"a\":[1,true,null,\"x\"],\"b\":{\"c\":2}}");
            Assert.AreEqual(JsonKind.Object, v.Kind);
            Assert.AreEqual(4, v.Get("a").AsArray.Count);
            Assert.AreEqual(2, v.Get("b").Get("c").AsInt);
        }

        [Test] public void Json_RejectsPrototypePollutionKey()
        {
            Assert.Throws<ShadowJsonException>(() => ShadowGuidedStoryJson.Parse("{\"__proto__\":{\"x\":1}}"));
        }

        [Test] public void Json_RejectsTrailingContent()
        {
            Assert.Throws<ShadowJsonException>(() => ShadowGuidedStoryJson.Parse("{} garbage"));
        }

        [Test] public void Vocabulary_MirrorsTheNodeSideSets()
        {
            Assert.AreEqual(13, ShadowGuidedStoryStatus.Statuses.Length);
            Assert.AreEqual(15, ShadowGuidedStoryStatus.TrustDimensions.Length);
            Assert.IsTrue(ShadowGuidedStoryStatus.IsStatus("FIRST_FAILURE"));
            Assert.IsFalse(ShadowGuidedStoryStatus.IsStatus("MADE_UP"));
            Assert.IsTrue(ShadowGuidedStoryStatus.IsTrustDimension("ANALYTICAL_CORRECTNESS"));
            // status carried by shape too, never colour alone
            Assert.AreEqual("octahedron", ShadowGuidedStoryStatus.ShapeOf("FIRST_FAILURE"));
            Assert.AreEqual("icosahedron", ShadowGuidedStoryStatus.ShapeOf("VERIFIED"));
        }

        [Test] public void Loader_LoadsAllThreeSnapshots()
        {
            foreach (var id in StoryIds)
            {
                var m = Load(id);
                Assert.AreEqual("shadow-guided-story-v1", m.StoryVersion);
                Assert.AreEqual(id, m.StoryId);
                Assert.Greater(m.Entities.Count, 0);
                Assert.Greater(m.Scenarios.Count, 0);
                Assert.Greater(m.Steps.Count, 0);
            }
        }

        [Test] public void Loader_FailsClosedOnUnknownStatus()
        {
            var good = File.ReadAllText(SnapshotPath("audit-chain"));
            var bad = good.Replace("\"VERIFIED\"", "\"MADE_UP\"");
            Assert.Throws<ShadowStoryLoadException>(() => ShadowGuidedStoryLoader.Load(bad));
        }

        [Test] public void Loader_EnforcesAnalyticalCorrectnessNotEvaluated()
        {
            var good = File.ReadAllText(SnapshotPath("audit-chain"));
            // flip ANALYTICAL_CORRECTNESS's value to VERIFIED in a dimension_status map
            var bad = good.Replace("\"ANALYTICAL_CORRECTNESS\": \"NOT_EVALUATED\"", "\"ANALYTICAL_CORRECTNESS\": \"VERIFIED\"");
            Assert.AreNotEqual(good, bad, "test setup: substitution happened");
            Assert.Throws<ShadowStoryLoadException>(() => ShadowGuidedStoryLoader.Load(bad));
        }

        [Test] public void Adapter_AuditChainTamper_HasSeq3FirstFailureAndDownstream456()
        {
            var m = Load("audit-chain");
            var view = ShadowGuidedStoryUnityAdapter.Project(m, "tamper_seq_3", "timeline", null);
            var ff = view.Nodes.Find(n => n.IsFirstFailure);
            Assert.AreEqual("banking-v1:n3:claim", ff.Id);
            Assert.AreEqual("FIRST_FAILURE", ff.Status);
            int downstream = view.Nodes.FindAll(n => n.IsDownstream).Count;
            Assert.AreEqual(3, downstream);
            var ac = view.Dimensions.Find(d => d.Dimension == "ANALYTICAL_CORRECTNESS");
            Assert.AreEqual("NOT_EVALUATED", ac.Status);
        }

        [Test] public void Adapter_AllLayoutsProduceFinitePositions()
        {
            var m = Load("persona-deliberation");
            foreach (var layout in ShadowGuidedStoryUnityAdapter.Layouts)
            {
                var view = ShadowGuidedStoryUnityAdapter.Project(m, "consensus_with_evidence", layout, null);
                foreach (var n in view.Nodes)
                {
                    Assert.IsFalse(float.IsNaN(n.Pos.x) || float.IsNaN(n.Pos.y) || float.IsNaN(n.Pos.z), layout + " finite");
                }
            }
        }

        [Test] public void Adapter_FocusContext_DimsNonFocusNodes()
        {
            var m = Load("audit-chain");
            var view = ShadowGuidedStoryUnityAdapter.Project(m, "tamper_seq_3", "timeline", new[] { "banking-v1:n3:claim" });
            var focused = view.Nodes.Find(n => n.Id == "banking-v1:n3:claim");
            Assert.IsTrue(focused.Focused);
            Assert.IsFalse(focused.Dimmed);
            foreach (var n in view.Nodes) if (n.Id != "banking-v1:n3:claim") Assert.IsTrue(n.Dimmed);
        }

        [Test] public void State_NextBackRestart_StayInBounds()
        {
            var m = Load("audit-chain");
            var s = new ShadowGuidedStoryState(m);
            Assert.AreEqual(0, s.StepIndex);
            for (int i = 0; i < 100; i++) s.Next();
            Assert.AreEqual(m.Steps.Count - 1, s.StepIndex);
            for (int i = 0; i < 100; i++) s.Back();
            Assert.AreEqual(0, s.StepIndex);
            s.Next(); s.Restart();
            Assert.AreEqual(0, s.StepIndex);
        }
    }
}
#endif
