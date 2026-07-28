// apps/shadow-lens/unity/Assets/ShadowLens/SpatialAgent/ShadowSpatialAgentMockTransport.cs
// Deterministic fixture transport (no network) for Gate 1 EditMode tests + the deterministic
// Unity demo. Returns canned, contract-shaped responses so the whole flow runs with no server or
// live model. SOURCE AUTHORED · UNITY COMPILE PENDING.
#if UNITY_2020_1_OR_NEWER
using System;

namespace ShadowLens.SpatialAgent
{
    public class ShadowSpatialAgentMockTransport : IShadowSpatialTransport
    {
        // A test/demo can override the responder; default = keyword-based deterministic grounding.
        public Func<string, ShadowTransportResult> Responder;

        public void Send(string url, string jsonBody, int timeoutMs, Action<ShadowTransportResult> onResult)
        {
            var r = (Responder ?? Default)(jsonBody);
            onResult?.Invoke(r); // synchronous — deterministic for tests
        }

        static ShadowTransportResult Ok(string body) => new ShadowTransportResult { ok = true, status = 200, body = body };

        public static ShadowTransportResult Grounded(string sourceId, string quote) => Ok(
            "{\"text\":\"Source " + sourceId + ": " + quote + "\",\"grounded\":true,\"model\":\"deterministic-fixture\",\"latency_ms\":1," +
            "\"citations\":[{\"source_id\":\"" + sourceId + "\",\"evidence_sequence\":-1,\"quote\":\"" + quote + "\"}]," +
            "\"actions\":[{\"name\":\"open_source_mode\",\"args\":{}},{\"name\":\"highlight_source\",\"args\":{\"source_id\":\"" + sourceId + "\"}}]," +
            "\"verification_summary\":null}");

        public static ShadowTransportResult Ungrounded() => Ok(
            "{\"text\":\"I can't ground that.\",\"grounded\":false,\"model\":\"deterministic-fixture\",\"latency_ms\":1,\"citations\":[],\"actions\":[],\"verification_summary\":null}");

        public static ShadowTransportResult Verified() => Ok(
            "{\"text\":\"Record integrity verified.\",\"grounded\":true,\"model\":\"deterministic-fixture\",\"latency_ms\":1,\"citations\":[],\"actions\":[]," +
            "\"verification_summary\":{\"record_integrity\":\"verified\",\"failed_seq\":-1,\"reason\":null}}");

        public static ShadowTransportResult Malformed() => Ok("{\"nope\":1}");
        public static ShadowTransportResult Unavailable() => new ShadowTransportResult { ok = false, status = 0, error = "backend unavailable" };

        ShadowTransportResult Default(string body)
        {
            var q = (body ?? "").ToLowerInvariant();
            if (q.Contains("verify")) return Verified();
            if (q.Contains("meaning of life") || q.Contains("unknown")) return Ungrounded();
            return Grounded("metric_auc", "test AUC = 0.912");
        }
    }
}
#endif
