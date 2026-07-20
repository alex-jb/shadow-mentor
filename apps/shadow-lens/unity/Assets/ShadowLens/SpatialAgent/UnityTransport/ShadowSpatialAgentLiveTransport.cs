// apps/shadow-lens/unity/Assets/ShadowLens/SpatialAgent/ShadowSpatialAgentLiveTransport.cs
// Live UnityWebRequest transport (no MonoBehaviour needed — subscribes to the async op). Timeout
// + abort supported. No key is ever sent from the client (the server holds keys). Not used until
// a provider is configured (§11); the fixture transport is the default. SOURCE AUTHORED · UNITY
// COMPILE PENDING.
#if UNITY_2020_1_OR_NEWER
using System;
using System.Text;
using UnityEngine.Networking;

namespace ShadowLens.SpatialAgent
{
    public class ShadowSpatialAgentLiveTransport : IShadowSpatialTransport
    {
        UnityWebRequest _inflight;
        public void Send(string url, string jsonBody, int timeoutMs, Action<ShadowTransportResult> onResult)
        {
            Cancel(); // one request at a time
            var req = new UnityWebRequest(url, "POST");
            req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(jsonBody ?? "{}"));
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            req.timeout = Math.Max(1, timeoutMs / 1000);
            _inflight = req;
            var op = req.SendWebRequest();
            op.completed += _ =>
            {
                var r = new ShadowTransportResult();
                if (req.result == UnityWebRequest.Result.Success) { r.ok = true; r.status = (int)req.responseCode; r.body = req.downloadHandler.text; }
                else { r.ok = false; r.status = (int)req.responseCode; r.error = req.error; }
                _inflight = null; req.Dispose();
                onResult?.Invoke(r);
            };
        }
        public void Cancel() { if (_inflight != null) { _inflight.Abort(); _inflight = null; } }
    }
}
#endif
