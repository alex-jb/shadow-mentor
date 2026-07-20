// apps/shadow-lens/unity/Assets/ShadowLens/SpatialAgent/ShadowSpatialAgentClient.cs
// Builds the request body (screenshot OFF by default §6), sends via an IShadowSpatialTransport
// (mock/fixture or a live UnityWebRequest transport), and parses + validates the response shape.
// Malformed / backend-unavailable are honest failures. SOURCE AUTHORED · UNITY COMPILE PENDING.
#if UNITY_2020_1_OR_NEWER
using System;
using UnityEngine;

namespace ShadowLens.SpatialAgent
{
    [Serializable] class ShadowAskBody {
        public string session_id, query, profile, current_mode, screenshot_base64;
        public string[] client_capabilities;
    }

    public class ShadowSpatialAgentClient
    {
        readonly ShadowSpatialAgentConfig _cfg;
        readonly IShadowSpatialTransport _transport;
        public ShadowSpatialAgentClient(ShadowSpatialAgentConfig cfg, IShadowSpatialTransport transport) { _cfg = cfg; _transport = transport; }

        public struct AskResult { public bool ok; public ShadowGroundedAnswerModel response; public string error; }

        public void Ask(string sessionId, string query, string currentMode, string screenshotB64, Action<AskResult> done)
        {
            if (string.IsNullOrEmpty(query) || string.IsNullOrWhiteSpace(query)) { done(new AskResult { ok = false, error = "empty query" }); return; }
            var body = new ShadowAskBody {
                session_id = sessionId, query = query, profile = _cfg.Profile, current_mode = currentMode,
                client_capabilities = _cfg.ClientCapabilities,
                screenshot_base64 = (_cfg.ScreenshotEnabled ? screenshotB64 : null), // §6 only when enabled
            };
            string json = JsonUtility.ToJson(body);
            _transport.Send(_cfg.BaseUrl + "/api/shadow-lens/spatial-agent", json, _cfg.TimeoutMs, (r) =>
            {
                if (!r.ok) { done(new AskResult { ok = false, error = "backend unavailable: " + (r.error ?? ("HTTP " + r.status)) }); return; }
                ShadowGroundedAnswerModel resp = null;
                try { resp = JsonUtility.FromJson<ShadowGroundedAnswerModel>(r.body); } catch { }
                if (resp == null || resp.text == null || resp.actions == null || resp.citations == null)
                { done(new AskResult { ok = false, error = "malformed response" }); return; }
                done(new AskResult { ok = true, response = resp });
            });
        }
    }
}
#endif
