// apps/shadow-lens/unity/Assets/ShadowLens/Tests/PlayMode/ShadowAuditWorkspaceLifecycleTests.cs
// Runtime-lifecycle proof for the Audit Workspace: repeated updates must NOT leak or duplicate runtime
// objects, and destroy/recreate must return to the same baseline. PlayMode because Destroy() is
// deferred and needs real frame progression. Counts are asserted (not just "no exception"). Writes a
// machine-readable result to media/spatial-ux-v11/audit-workspace/lifecycle-inventory.json.
#if UNITY_INCLUDE_TESTS
using System.Collections;
using System.Collections.Generic;
using System.IO;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using ShadowLens.GuidedStory;
using ShadowLens.Workspace;
using P = ShadowLens.Design.ShadowDesignTokens.ShadowVisualProfile;

namespace ShadowLens.Tests.PlayMode
{
    public class ShadowAuditWorkspaceLifecycleTests
    {
        static GuidedStorySemantic Model()
        {
            var m = new GuidedStorySemantic { StoryId = "banking", Title = new Bilingual { En = "Banking Audit", Zh = "银行审计" } };
            m.Entities.Add(new StoryEntity { Id = "income", Kind = "record", Sequence = 1, Label = new Bilingual { En = "Income", Zh = "收入" }, EvidenceRef = "ev.income" });
            m.Entities.Add(new StoryEntity { Id = "dti", Kind = "record", Sequence = 2, Label = new Bilingual { En = "DTI", Zh = "债务收入比" }, EvidenceRef = "ev.dti" });
            m.Entities.Add(new StoryEntity { Id = "decision", Kind = "decision", Sequence = 3, Label = new Bilingual { En = "Council Decision", Zh = "委员会决策" }, EvidenceRef = null });
            m.Entities.Add(new StoryEntity { Id = "pricing", Kind = "record", Sequence = 4, Label = new Bilingual { En = "Pricing Tier", Zh = "定价档位" }, EvidenceRef = "ev.pricing" });
            return m;
        }
        static StoryScenario Scenario(string review, string approval)
        {
            var sc = new StoryScenario { Id = "s", FirstFailure = "decision" };
            sc.AffectedDownstream.Add("pricing");
            sc.EntityStatus["income"] = "VERIFIED"; sc.EntityStatus["dti"] = "VERIFIED";
            sc.EntityStatus["decision"] = "FIRST_FAILURE"; sc.EntityStatus["pricing"] = "AFFECTED_DOWNSTREAM";
            sc.DimensionStatus["HUMAN_REVIEW"] = review; sc.DimensionStatus["HUMAN_APPROVAL"] = approval;
            sc.DimensionStatus["TRUST_POSTURE"] = "SELF_SIGNED";
            return sc;
        }

        struct Snap { public int regions, texts, renderers, quads, uniqueMats; }

        static int SceneRegionCount()
        {
            int n = 0;
            foreach (var t in Object.FindObjectsByType<Transform>(FindObjectsSortMode.None))
                if (t.name.StartsWith("region.")) n++;
            return n;
        }

        static Snap Count(GameObject root)
        {
            var s = new Snap();
            if (root == null) return s;
            foreach (Transform c in root.transform) if (c.name.StartsWith("region.")) s.regions++;
            s.texts = root.GetComponentsInChildren<TextMesh>(true).Length;
            var rends = root.GetComponentsInChildren<Renderer>(true);
            s.renderers = rends.Length;
            var mats = new HashSet<int>();
            foreach (var r in rends) { if (r is MeshRenderer mr && mr.GetComponent<TextMesh>() == null) s.quads++; if (r.sharedMaterial != null) mats.Add(r.sharedMaterial.GetInstanceID()); }
            s.uniqueMats = mats.Count;
            return s;
        }

        GameObject Make(GuidedStorySemantic m, StoryScenario sc, string focus, out ShadowAuditWorkspace ws)
        {
            var go = new GameObject("AuditWorkspace");
            ws = go.AddComponent<ShadowAuditWorkspace>();
            ws.Profile = P.DesktopDark; ws.Zh = false; ws.Tracking = "TRACKED_3DOF";
            ws.BindDirect(m, sc, focus);
            return go;
        }

        [UnityTest]
        public IEnumerator RepeatedUpdates_DoNotLeakOrDuplicate()
        {
            var m = Model();
            var baseScenario = Scenario("REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT");
            var root = Make(m, baseScenario, "decision", out var ws);
            yield return null; yield return null;
            var baseline = Count(root);
            Assert.AreEqual(5, baseline.regions, "expected exactly 5 workspace regions at baseline");
            Assert.Greater(baseline.texts, 10, "baseline should render labels");

            // 32 deterministic update cycles
            string[] focuses = { "income", "dti", "decision", "pricing" };
            string[] tracks = { "SCANNING", "LIMITED", "LOST", "RECOVERING", "TRACKED_3DOF" };
            var max = baseline;
            for (int i = 0; i < 32; i++)
            {
                ws.FocusOn(focuses[i % focuses.Length]);
                if (i % 3 == 0) ws.SetZh(i % 6 == 0);           // EN → zh → EN …
                ws.SetTracking(tracks[i % tracks.Length]);
                if (i % 5 == 0) { ws.SwitchMode(ShadowPresentationMode.PrimitiveDiagnostic); ws.SwitchMode(ShadowPresentationMode.AuditWorkspace); }
                if (i % 7 == 0) ws.BindDirect(m, Scenario("HUMAN_REVIEW_RECORDED", "APPROVAL_PRESENT"), focuses[i % focuses.Length]);
                yield return null; yield return null; // let deferred Destroy settle
                var c = Count(root);
                Assert.AreEqual(5, c.regions, $"cycle {i}: regions must stay 5 (no duplicate region)");
                if (c.texts > max.texts) max.texts = c.texts;
                if (c.renderers > max.renderers) max.renderers = c.renderers;
                if (c.uniqueMats > max.uniqueMats) max.uniqueMats = c.uniqueMats;
                // no monotonic explosion: text count for any single state is bounded well under 200
                Assert.Less(c.texts, 200, $"cycle {i}: text objects exploded ({c.texts}) — leak");
            }

            // return to the EXACT baseline state → counts must match baseline (no per-update accumulation)
            ws.SetZh(false); ws.SetTracking("TRACKED_3DOF"); ws.BindDirect(m, baseScenario, "decision");
            yield return null; yield return null; yield return null;
            var settled = Count(root);
            Assert.AreEqual(baseline.regions, settled.regions);
            Assert.AreEqual(baseline.texts, settled.texts, "same state must return to the same text count (no leak)");
            Assert.LessOrEqual(settled.uniqueMats, baseline.uniqueMats + 1, "material instances must not grow per update");
            Assert.AreEqual(1, SceneRegionCount() / 5, "exactly one workspace's worth of regions in the scene");

            // destroy → recreate returns to baseline; shared material cache does not create per-instance materials
            Object.Destroy(root);
            yield return null; yield return null;
            Assert.IsTrue(root == null, "workspace root must be destroyed");
            Assert.AreEqual(0, SceneRegionCount(), "no orphan region.* objects after destroy");

            var root2 = Make(m, baseScenario, "decision", out var ws2);
            yield return null; yield return null;
            var recreated = Count(root2);
            Assert.AreEqual(baseline.regions, recreated.regions, "recreate: region count matches baseline");
            Assert.AreEqual(baseline.texts, recreated.texts, "recreate: text count matches baseline");
            Assert.LessOrEqual(recreated.uniqueMats, baseline.uniqueMats + 1, "recreate: shared materials not duplicated per instance");

            // machine-readable result
            var outDir = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", "..", "..", "media", "spatial-ux-v11", "audit-workspace"));
            Directory.CreateDirectory(outDir);
            string J(Snap s) => "{\"regions\":" + s.regions + ",\"texts\":" + s.texts + ",\"renderers\":" + s.renderers + ",\"quads\":" + s.quads + ",\"uniqueMats\":" + s.uniqueMats + "}";
            File.WriteAllText(Path.Combine(outDir, "lifecycle-inventory.json"),
                "{\n  \"baseline\": " + J(baseline) + ",\n  \"max_during_updates\": " + J(max) + ",\n  \"final_same_state\": " + J(settled) +
                ",\n  \"after_recreate\": " + J(recreated) + ",\n  \"cycles\": 32, \"device_validated\": false\n}\n");

            Object.Destroy(root2);
            yield return null;
        }
    }
}
#endif
