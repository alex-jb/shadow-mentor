// apps/shadow-lens/unity/Assets/ShadowLens/SpatialAgent/ShadowSpatialSceneIndex.cs
// Indexes the REAL scene-graph object ids so the validator can reject invented ids. Built from
// the server's shadow-evidence-scene-v1 (source of truth). Pure (UnityEngine-free) → EditMode
// testable. SOURCE AUTHORED · UNITY COMPILE PENDING.
#if UNITY_2020_1_OR_NEWER
using System;
using System.Collections.Generic;

namespace ShadowLens.SpatialAgent
{
    [Serializable] public class ShadowSceneObject { public string id; public string type; public string label; public string status; }
    [Serializable] public class ShadowSceneGraph { public string scene_version; public string session_id; public string profile_id; public ShadowSceneObject[] objects = Array.Empty<ShadowSceneObject>(); }

    public class ShadowSpatialSceneIndex : IShadowSceneObjectResolver
    {
        private readonly HashSet<string> _ids = new HashSet<string>();
        private readonly List<string> _order = new List<string>();

        public ShadowSpatialSceneIndex(ShadowSceneGraph graph)
        {
            if (graph?.objects == null) return;
            foreach (var o in graph.objects) if (o != null && !string.IsNullOrEmpty(o.id) && _ids.Add(o.id)) _order.Add(o.id);
        }

        public bool Has(string id) => id != null && _ids.Contains(id);
        public string[] AllIds() => _order.ToArray();
    }
}
#endif
