// apps/shadow-lens/unity/Assets/ShadowLens/Core/ShadowLensRuntime.cs
// Mock providers (Editor path), the closed voice-command router (never LLM-routed), and
// the API client that calls the real /api/shadow-lens-analyze pipeline. SOFTWARE
// IMPLEMENTED · LOCAL UNITY COMPILE NOT EXECUTED.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;

namespace ShadowLens.Core
{
    // ── mock providers: let the Editor run capture→OCR→analysis without hardware ──
    public class MockFrameProvider : IStillCaptureProvider, IFramePreviewProvider
    {
        public bool PreviewAvailable => true;
        public string CapturePathUsed => "mock";
        public CapturedFrame? CaptureStill()
        {
            var bytes = Encoding.UTF8.GetBytes("mock-financial-statement-frame");
            return new CapturedFrame { Bytes = bytes, Width = 1280, Height = 1656, RotationDeg = 0, Mime = "image/png" };
        }
        public static string Sha256Hex(byte[] b)
        {
            using var s = SHA256.Create();
            var sb = new StringBuilder("sha256:");
            foreach (var x in s.ComputeHash(b)) sb.Append(x.ToString("x2"));
            return sb.ToString();
        }
    }

    public class MockOcrProvider : IOcrProvider
    {
        public string EngineId => "mock";
        public void Recognize(CapturedFrame frame, Action<IReadOnlyList<SourceEntry>> onResult, Action<string> onError)
        {
            onResult(new List<SourceEntry> {
                new SourceEntry { SourceId = "B0L0", Text = "FICO Score: 706", X = 0.10f, Y = 0.30f, W = 0.40f, H = 0.03f, Confidence = 0.97f, Language = "en" },
                new SourceEntry { SourceId = "B0L1", Text = "Debt-to-Income: 0.41", X = 0.10f, Y = 0.34f, W = 0.46f, H = 0.03f, Confidence = 0.95f, Language = "en" },
            });
        }
    }

    // ── voice: closed command enum, deterministic routing (an LLM NEVER picks UI actions) ──
    public enum VoiceCommand { None, ScanDocument, Capture, CancelCapture, Analyze, ShowRisks, ShowScenarios, ShowReview, ShowAudit, ShowSource, Verify, ReturnToDocument, Reset }

    public static class VoiceCommandRouter
    {
        public static VoiceCommand Route(string text)
        {
            var t = (text ?? "").ToLowerInvariant();
            if (t.Contains("scan")) return VoiceCommand.ScanDocument;
            if (t.Contains("capture")) return VoiceCommand.Capture;
            if (t.Contains("cancel")) return VoiceCommand.CancelCapture;
            if (t.Contains("analy")) return VoiceCommand.Analyze;
            if (t.Contains("risk")) return VoiceCommand.ShowRisks;
            if (t.Contains("scenario")) return VoiceCommand.ShowScenarios;
            if (t.Contains("review") || t.Contains("council")) return VoiceCommand.ShowReview;
            if (t.Contains("audit")) return VoiceCommand.ShowAudit;
            if (t.Contains("source")) return VoiceCommand.ShowSource;
            if (t.Contains("verify")) return VoiceCommand.Verify;
            if (t.Contains("document") || t.Contains("back")) return VoiceCommand.ReturnToDocument;
            if (t.Contains("reset")) return VoiceCommand.Reset;
            return VoiceCommand.None; // grounded questions go to the analysis path, not here
        }
    }

    // ── API client: posts the source_map to the real pipeline; returns the session JSON ──
    // Uses UnityWebRequest at runtime (guarded so this file also parses in plain C#).
    public class ShadowLensApiClient
    {
        public string BaseUrl = "https://shadow-mentor-phi.vercel.app";
        public int TimeoutSec = 20;

        // Build the request body (source_map + capture) — pure, unit-testable in EditMode.
        public static string BuildRequestBody(string sessionId, string captureSha256, IReadOnlyList<SourceEntry> sm)
        {
            var sb = new StringBuilder();
            sb.Append("{\"session_id\":").Append(J(sessionId));
            sb.Append(",\"capture\":{\"capture_id\":\"cap\",\"capture_sha256\":").Append(J(captureSha256)).Append(",\"capture_method\":\"xreal-eye-still\"}");
            sb.Append(",\"device\":{\"platform\":\"unity-xreal\",\"runtime_mode\":\"UNITY_XREAL\",\"tracking_mode\":\"6dof\",\"camera_mode\":\"xreal-eye\"}");
            sb.Append(",\"source_map\":[");
            for (int i = 0; i < sm.Count; i++)
            {
                var e = sm[i];
                if (i > 0) sb.Append(',');
                sb.Append("{\"source_id\":").Append(J(e.SourceId)).Append(",\"text\":").Append(J(e.Text))
                  .Append(",\"confidence\":").Append(e.Confidence.ToString(System.Globalization.CultureInfo.InvariantCulture))
                  .Append(",\"bounding_box_normalized\":{\"x\":").Append(F(e.X)).Append(",\"y\":").Append(F(e.Y)).Append(",\"w\":").Append(F(e.W)).Append(",\"h\":").Append(F(e.H)).Append("}}");
            }
            sb.Append("]}");
            return sb.ToString();
        }
        private static string J(string s) => "\"" + (s ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
        private static string F(float f) => f.ToString(System.Globalization.CultureInfo.InvariantCulture);
    }
}
