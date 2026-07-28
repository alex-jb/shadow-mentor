// apps/shadow-lens/unity/Assets/ShadowLens/Mock/ShadowSpatialDemoFixtures.cs
// Deterministic per-profile demo data for the Gate 2 spatial-agent panel: a small real-id scene
// graph + a canned responder per profile, so the three required questions produce visible,
// grounded results with NO live LLM and NO network. Ids match what the responder cites (never
// invented at answer time). SOURCE AUTHORED · compiled + tested in Unity 6 (Gate 2).
#if UNITY_2020_1_OR_NEWER
using System;
using ShadowLens.SpatialAgent;

namespace ShadowLens.Mock
{
    public static class ShadowSpatialDemoFixtures
    {
        public static ShadowSceneGraph SceneFor(string profile)
        {
            switch (profile)
            {
                case "data-science-v1":
                    return Graph(profile, new[] {
                        ("dataset", "tool"), ("metric_auc", "metric"), ("selection", "model"), ("verify", "anchor") });
                case "coding-agent-v1":
                    return Graph(profile, new[] {
                        ("issue", "issue"), ("diff1", "tool"), ("cmd_test", "test"), ("commit", "commit"), ("verify", "anchor") });
                default: // banking-v1
                    return Graph("banking-v1", new[] {
                        ("capture", "capture"), ("B0L1", "source"), ("c1", "claim"), ("verify", "anchor") });
            }
        }

        static ShadowSceneGraph Graph(string profile, (string id, string type)[] objs)
        {
            var g = new ShadowSceneGraph { scene_version = "shadow-evidence-scene-v1", session_id = profile + "-demo", profile_id = profile };
            g.objects = new ShadowSceneObject[objs.Length];
            for (int i = 0; i < objs.Length; i++) g.objects[i] = new ShadowSceneObject { id = objs[i].id, type = objs[i].type, status = "verified" };
            return g;
        }

        // A responder keyed on the request body (contains the query). Deterministic, offline.
        public static Func<string, ShadowTransportResult> ResponderFor(string profile)
        {
            return body =>
            {
                var q = (body ?? "").ToLowerInvariant();
                if (q.Contains("verify")) return ShadowSpatialAgentMockTransport.Verified();
                if (q.Contains("meaning of life") || q.Contains("weather")) return ShadowSpatialAgentMockTransport.Ungrounded();
                switch (profile)
                {
                    case "data-science-v1":
                        // "why was this model selected?" → cite the AUC metric + focus the selection
                        return Grounded("Selected GBM: highest test AUC.", "metric_auc", "test AUC = 0.912",
                            new[] { Act("open_experiment_mode"), Act("highlight_metric", "object_id", "metric_auc"), Act("focus_object", "object_id", "selection") });
                    case "coding-agent-v1":
                        // "which change fixed the duplicate EventSystem?" → focus the diff + test evidence
                        return Grounded("The null/duplicate guard in diff1; tests pass.", "cmd_test", "npm test → 42 passed",
                            new[] { Act("open_code_replay_mode"), Act("focus_object", "object_id", "diff1"), Act("highlight_source", "source_id", "cmd_test") });
                    default: // banking
                        // "show the source supporting the highest-risk finding" → highlight the DTI source
                        return Grounded("DTI 0.41 exceeds the 0.36 ceiling.", "B0L1", "Debt-to-Income: 0.41",
                            new[] { Act("open_source_mode"), Act("highlight_source", "source_id", "B0L1") });
                }
            };
        }

        static ShadowTransportResult Grounded(string text, string citeId, string quote, string[] actionsJson)
        {
            string cites = "[{\"source_id\":\"" + citeId + "\",\"evidence_sequence\":-1,\"quote\":\"" + quote + "\"}]";
            string body = "{\"text\":\"" + text + "\",\"grounded\":true,\"model\":\"deterministic-fixture\",\"latency_ms\":1," +
                "\"citations\":" + cites + ",\"actions\":[" + string.Join(",", actionsJson) + "],\"verification_summary\":null}";
            return new ShadowTransportResult { ok = true, status = 200, body = body };
        }
        static string Act(string name, string argKey = null, string id = null)
        {
            string args = argKey == null ? "{}" : "{\"" + argKey + "\":\"" + id + "\"}";
            return "{\"name\":\"" + name + "\",\"args\":" + args + "}";
        }
    }
}
#endif
