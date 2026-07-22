// apps/shadow-lens/unity/Assets/ShadowLens/GuidedStory/ShadowGuidedStoryUnityAdapter.cs
// Pure layout adapter: given a loaded semantic model + a scenario + a layout, it returns advisory V3
// positions and per-node status/first-failure/downstream — the SAME projection the Three.js adapter
// produces, so the two engines place the same meaning (positions may differ; identity may not).
// Reuses ShadowLens.Spatial.SpatialLayout.AuditArc for the arc layout. Pure C# (uses V3, no
// MonoBehaviour), EditMode-tested. SOURCE AUTHORED.
using System.Collections.Generic;
using ShadowLens.Spatial; // V3, SpatialLayout

namespace ShadowLens.GuidedStory
{
    public struct StoryNodeView
    {
        public string Id, Kind, Status, Shape, ColorKey;
        public int Sequence;
        public V3 Pos;
        public bool IsFirstFailure, IsDownstream, Focused, Dimmed;
    }

    public struct StoryDimView { public string Dimension, Status; }

    public sealed class StorySceneView
    {
        public string ScenarioId, Layout, FirstFailure;
        public List<StoryNodeView> Nodes = new List<StoryNodeView>();
        public List<StoryDimView> Dimensions = new List<StoryDimView>();
        public List<(string from, string to, string type, bool degraded)> Edges = new List<(string, string, string, bool)>();
    }

    public static class ShadowGuidedStoryUnityAdapter
    {
        public static readonly string[] Layouts = { "timeline", "arc", "dag", "radial", "hybrid" };

        public static StorySceneView Project(GuidedStorySemantic m, string scenarioId, string layout, IEnumerable<string> focusEntities = null)
        {
            var sc = m.ScenarioById(scenarioId);
            if (sc == null) throw new ShadowStoryLoadException("unknown scenario " + scenarioId);
            var nodes = new List<StoryEntity>(m.Entities);
            nodes.Sort((a, b) => a.Sequence.CompareTo(b.Sequence));
            var pos = Layout(nodes, layout);

            var focus = new HashSet<string>();
            if (focusEntities != null) foreach (var f in focusEntities) focus.Add(f);

            var view = new StorySceneView { ScenarioId = scenarioId, Layout = layout, FirstFailure = sc.FirstFailure };
            for (int i = 0; i < nodes.Count; i++)
            {
                var n = nodes[i];
                string status = sc.EntityStatus.TryGetValue(n.Id, out var s) ? s : "VERIFIED";
                view.Nodes.Add(new StoryNodeView
                {
                    Id = n.Id, Kind = n.Kind, Sequence = n.Sequence, Status = status,
                    Shape = ShadowGuidedStoryStatus.ShapeOf(status), ColorKey = ShadowGuidedStoryStatus.ColorKeyOf(status),
                    Pos = pos[i],
                    IsFirstFailure = sc.FirstFailure == n.Id,
                    IsDownstream = sc.AffectedDownstream.Contains(n.Id),
                    Focused = focus.Count == 0 || focus.Contains(n.Id),
                    Dimmed = focus.Count > 0 && !focus.Contains(n.Id),
                });
            }
            foreach (var d in m.TrustDimensions)
                view.Dimensions.Add(new StoryDimView { Dimension = d, Status = sc.DimensionStatus.TryGetValue(d, out var ds) ? ds : "NOT_CHECKED" });

            var ids = new HashSet<string>();
            foreach (var n in nodes) ids.Add(n.Id);
            foreach (var r in m.Relations)
            {
                if (!ids.Contains(r.From) || !ids.Contains(r.To)) continue;
                string fs = sc.EntityStatus.TryGetValue(r.From, out var a) ? a : "VERIFIED";
                string ts = sc.EntityStatus.TryGetValue(r.To, out var b) ? b : "VERIFIED";
                bool degraded = !Ok(fs) && !Ok(ts);
                view.Edges.Add((r.From, r.To, r.Type, degraded));
            }
            return view;
        }

        static bool Ok(string s) => s == "VERIFIED" || s == "PRESENT" || s == "NOT_EVALUATED";

        // ── layouts (mirror the Three.js adapter's math) ──
        static V3[] Layout(List<StoryEntity> nodes, string layout)
        {
            switch (layout)
            {
                case "arc": return Arc(nodes.Count);
                case "dag": return Dag(nodes);
                case "radial": return Radial(nodes);
                case "hybrid": return Hybrid(nodes);
                default: return Timeline(nodes.Count);
            }
        }

        static V3[] Timeline(int n)
        {
            var p = new V3[n];
            float span = 3.2f, x0 = -span / 2f, dx = n > 1 ? span / (n - 1) : 0f;
            for (int i = 0; i < n; i++) p[i] = new V3(x0 + i * dx, 0f, 0f);
            return p;
        }
        static V3[] Arc(int n)
        {
            // reuse the tested SpatialLayout.AuditArc (radius 1.9, span 120°) for a shallow forward arc
            return SpatialLayout.AuditArc(n, 1.9f, 120f, 0f, -0.1f);
        }
        static V3[] Dag(List<StoryEntity> nodes)
        {
            var band = new System.Func<string, int>(k =>
            {
                if (k == "source" || k == "snapshot" || k == "dictionary" || k == "shared_evidence" || k == "evidence" || k == "evidence_ref") return 0;
                if (k == "claim" || k == "persona" || k == "reason_code") return 1;
                return 2;
            });
            var byBand = new List<string>[] { new List<string>(), new List<string>(), new List<string>() };
            foreach (var n in nodes) byBand[band(n.Kind)].Add(n.Id);
            var pos = new Dictionary<string, V3>();
            for (int b = 0; b < 3; b++)
            {
                var ids = byBand[b];
                float w = 3.0f, x0 = -w / 2f, dx = ids.Count > 1 ? w / (ids.Count - 1) : 0f;
                for (int i = 0; i < ids.Count; i++) pos[ids[i]] = new V3(ids.Count > 1 ? x0 + i * dx : 0f, (b - 1) * 0.9f, 0f);
            }
            var outp = new V3[nodes.Count];
            for (int i = 0; i < nodes.Count; i++) outp[i] = pos[nodes[i].Id];
            return outp;
        }
        static V3[] Radial(List<StoryEntity> nodes)
        {
            var pos = new Dictionary<string, V3>();
            var personas = nodes.FindAll(n => n.Kind == "persona");
            var evidence = nodes.FindAll(n => n.Kind == "shared_evidence");
            var centre = nodes.FindAll(n => n.Kind == "synthesis");
            const float TAU = 6.28318530718f;
            for (int i = 0; i < personas.Count; i++) { float a = (float)i / (personas.Count < 1 ? 1 : personas.Count) * TAU; pos[personas[i].Id] = new V3(Cos(a) * 1.6f, Sin(a) * 1.6f, 0f); }
            for (int i = 0; i < evidence.Count; i++) { float a = (float)i / (evidence.Count < 1 ? 1 : evidence.Count) * TAU + (evidence.Count > 0 ? 3.14159265f / evidence.Count : 0f); pos[evidence[i].Id] = new V3(Cos(a) * 0.85f, Sin(a) * 0.85f, 0.2f); }
            foreach (var c in centre) pos[c.Id] = new V3(0f, 0f, 0.4f);
            for (int i = 0; i < nodes.Count; i++) if (!pos.ContainsKey(nodes[i].Id)) { float a = (float)i / nodes.Count * TAU; pos[nodes[i].Id] = new V3(Cos(a) * 1.2f, Sin(a) * 1.2f, 0f); }
            var outp = new V3[nodes.Count];
            for (int i = 0; i < nodes.Count; i++) outp[i] = pos[nodes[i].Id];
            return outp;
        }
        static V3[] Hybrid(List<StoryEntity> nodes)
        {
            var rowY = new Dictionary<string, float> { { "dictionary", 0.9f }, { "reason_code", 0.1f }, { "evidence_ref", -0.8f }, { "attestation", 0.1f } };
            var rows = new Dictionary<string, List<string>>();
            foreach (var n in nodes) { if (!rows.ContainsKey(n.Kind)) rows[n.Kind] = new List<string>(); rows[n.Kind].Add(n.Id); }
            var pos = new Dictionary<string, V3>();
            foreach (var kv in rows)
            {
                bool isAtt = kv.Key == "attestation";
                var ids = kv.Value;
                float w = 2.6f, x0 = isAtt ? 1.7f : -w / 2f, dx = (!isAtt && ids.Count > 1) ? w / (ids.Count - 1) : 0f;
                float y = rowY.TryGetValue(kv.Key, out var ry) ? ry : 0f;
                for (int i = 0; i < ids.Count; i++) pos[ids[i]] = new V3(isAtt ? x0 : (ids.Count > 1 ? x0 + i * dx : 0f), y, 0f);
            }
            var outp = new V3[nodes.Count];
            for (int i = 0; i < nodes.Count; i++) outp[i] = pos[nodes[i].Id];
            return outp;
        }

        static float Cos(float a) => (float)System.Math.Cos(a);
        static float Sin(float a) => (float)System.Math.Sin(a);
    }
}
