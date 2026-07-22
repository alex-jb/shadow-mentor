// apps/shadow-lens/unity/Assets/ShadowLens/Tests/PlayMode/ShadowLensV11CaptureHarness.cs
// V11 render harness — drives the REAL Shadow Lens guided-story player + capability banner in PLAY MODE
// (real Awake/Update/rendering) and captures deterministic offscreen screenshots for design review.
// This is NOT device evidence and NEVER claims to be. It is env-gated (SHADOW_CAPTURE=1) so the normal
// PlayMode suite is unaffected — it Assert.Ignore()s otherwise.
//
// Run:  SHADOW_CAPTURE=1 SHADOW_CAPTURE_COMMIT=$(git rev-parse HEAD) Unity -batchmode -runTests \
//         -testPlatform PlayMode -testFilter ".*V11Capture.*" ...
#if UNITY_INCLUDE_TESTS
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Text;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using ShadowLens.GuidedStory;
using ShadowLens.Device;
using ShadowLens.Core;
using ShadowLens.Design;

namespace ShadowLens.Tests.PlayMode
{
    public class ShadowLensV11CaptureHarness
    {
        const int W = 1600, H = 1000;
        static string OutDir => Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", "..", "..", "media", "spatial-ux-v11", "unity"));
        static string SnapPath(string id) => Path.Combine(Application.dataPath, "ShadowLens", "GuidedStory", "Snapshots", id + ".semantic.json");

        Camera _cam; RenderTexture _rt; ShadowGuidedStoryPlayer _player; ShadowDeviceCapabilityBanner _banner; Font _cjk;
        readonly List<string> _manifest = new List<string>();

        [UnityTest]
        public IEnumerator CaptureReviewMedia()
        {
            if (System.Environment.GetEnvironmentVariable("SHADOW_CAPTURE") != "1")
            { Assert.Ignore("V11 capture harness — set SHADOW_CAPTURE=1 to render review media (kept out of the normal suite)."); yield break; }

            Directory.CreateDirectory(OutDir);
            // Remove the AutoBoot-injected ShadowStageController/bootstrap (a SEPARATE experience) so it
            // doesn't pollute the guided-story capture with a stray case-core sphere/ring.
            yield return null;
            foreach (var sc in Object.FindObjectsByType<ShadowLens.Narrative.ShadowStageController>(FindObjectsSortMode.None)) Object.Destroy(sc.transform.root.gameObject);
            foreach (var bs in Object.FindObjectsByType<ShadowLens.Bootstrap.ShadowLensRuntimeBootstrap>(FindObjectsSortMode.None)) Object.Destroy(bs.transform.root.gameObject);
            yield return null;

            // OST bright globally (affects token consumers; the guided-story player uses its own palette — a documented finding).
            ShadowDesignTokens.ActiveProfile = ShadowDesignTokens.ShadowVisualProfile.XrealOstBright;

            // CJK-capable OS font so Latin + Simplified Chinese both render (built-in fonts have no CJK).
            _cjk = Font.CreateDynamicFontFromOSFont(new[] { "Hiragino Sans GB", "STHeiti", "PingFang SC" }, 64);

            // ── scene: light + camera(RT) + player + banner ──
            var light = new GameObject("DirLight").AddComponent<Light>();
            light.type = LightType.Directional; light.intensity = 1.1f; light.transform.rotation = Quaternion.Euler(50, -30, 0);
            RenderSettings.ambientLight = new Color(0.55f, 0.57f, 0.6f);

            _rt = new RenderTexture(W, H, 24, RenderTextureFormat.ARGB32);
            var camGo = new GameObject("CaptureCam"); camGo.tag = "MainCamera";
            _cam = camGo.AddComponent<Camera>();
            // Framed close on the node row (nodes at y=0, x∈[-1.6,1.6]) so the small world-space labels are legible.
            _cam.transform.position = new Vector3(0f, 0.16f, -2.7f); _cam.transform.LookAt(new Vector3(0f, 0.12f, 0f));
            _cam.fieldOfView = 54; _cam.clearFlags = CameraClearFlags.SolidColor;
            _cam.backgroundColor = new Color(0.035f, 0.045f, 0.065f); // design dark bg; OST sims composite over real backgrounds
            _cam.targetTexture = _rt;

            // player — build inactive with Snapshots + font assigned, then activate so Awake→LoadStory(0) runs with data
            var pGo = new GameObject("GuidedStoryPlayer"); pGo.SetActive(false);
            _player = pGo.AddComponent<ShadowGuidedStoryPlayer>();
            _player.LabelFont = _cjk;
            foreach (var id in new[] { "audit-chain", "reason-code-attestation", "persona-deliberation" })
                _player.Snapshots.Add(new TextAsset(File.ReadAllText(SnapPath(id))));
            pGo.SetActive(true);

            // banner
            var bGo = new GameObject("CapabilityBanner"); bGo.transform.position = new Vector3(0f, 0.72f, 0f); bGo.transform.localScale = Vector3.one * 0.05f;
            _banner = bGo.AddComponent<ShadowDeviceCapabilityBanner>();
            yield return null; yield return null; // let Awake/Refresh run
            var bannerTm = _banner.GetComponentInChildren<TextMesh>();
            if (bannerTm != null && _cjk != null) { bannerTm.font = _cjk; var mr = bannerTm.GetComponent<MeshRenderer>(); if (mr) mr.sharedMaterial = _cjk.material; }

            // ── shots ──
            _player.LoadStory(0); _player.SetLanguage(false); _player.ApiRestart();
            yield return Shot("01-banking-overview-en", "audit-chain", 0, "en", "TRACKING (mock)");

            _player.ApiRestart(); _player.ApiNext(); _player.ApiNext(); _player.ApiNext();
            yield return Shot("02-first-failure-en", "audit-chain", 3, "en", "TRACKING (mock)");

            _player.ApiRestart(); for (int i = 0; i < 4; i++) _player.ApiNext();
            yield return Shot("03-downstream-impact-en", "audit-chain", 4, "en", "TRACKING (mock)");

            // tracking states via the REAL presentation path (probe → 3DoF so health override applies)
            _player.ApiRestart();
            _banner.Probe.XrealSdkRuntime = true; _banner.Probe.LoaderStarted = true; _banner.Probe.Reported = TrackingMode.ThreeDof;
            _banner.Tracking.OnLoaderStarted();
            _banner.Tracking.Report(ShadowNotTrackingReason.Scanning, false); _banner.Refresh(); ReFont();
            yield return Shot("04-tracking-scanning", "audit-chain", 0, "en", "SCANNING→TRACKING LIMITED");

            _banner.Tracking.Report(ShadowNotTrackingReason.Unknown, false); _banner.Refresh(); ReFont();
            yield return Shot("05-tracking-lost", "audit-chain", 0, "en", "TRACKING LOST");

            // reset banner to nominal + Chinese overview (banner + player both ZH)
            _banner.Tracking.Report(ShadowNotTrackingReason.None, true); _banner.Zh = true; _banner.Refresh();
            _player.SetLanguage(true); _player.ApiRestart(); ReFont();
            yield return Shot("06-banking-overview-zh", "audit-chain", 0, "zh", "TRACKING (mock)");

            WriteManifest();
            // sanity: every PNG exists + is non-trivial
            foreach (var n in new[] { "01-banking-overview-en", "02-first-failure-en", "03-downstream-impact-en", "04-tracking-scanning", "05-tracking-lost", "06-banking-overview-zh" })
            {
                var p = Path.Combine(OutDir, n + ".png");
                Assert.IsTrue(File.Exists(p), "missing " + p);
                Assert.Greater(new FileInfo(p).Length, 3000, "suspiciously small PNG: " + n);
            }
        }

        void ReFont()
        {
            if (_cjk == null) return;
            var tm = _banner != null ? _banner.GetComponentInChildren<TextMesh>() : null;
            if (tm != null) { tm.font = _cjk; var mr = tm.GetComponent<MeshRenderer>(); if (mr) mr.sharedMaterial = _cjk.material; }
        }

        IEnumerator Shot(string name, string story, int step, string lang, string tracking)
        {
            yield return null; yield return null;               // let Rebuild()/Refresh() apply
            _cam.Render();
            var prev = RenderTexture.active; RenderTexture.active = _rt;
            var tex = new Texture2D(W, H, TextureFormat.RGBA32, false);
            tex.ReadPixels(new Rect(0, 0, W, H), 0, 0); tex.Apply();
            RenderTexture.active = prev;
            File.WriteAllBytes(Path.Combine(OutDir, name + ".png"), tex.EncodeToPNG());
            Object.Destroy(tex);

            var commit = System.Environment.GetEnvironmentVariable("SHADOW_CAPTURE_COMMIT") ?? "unknown";
            var cp = _cam.transform;
            _manifest.Add(
                "{\"file\":\"" + name + ".png\",\"source_commit\":\"" + commit + "\",\"unity\":\"" + Application.unityVersion +
                "\",\"scene\":\"harness:GuidedStoryPlayer+CapabilityBanner\",\"story_fixture\":\"" + story + ".semantic.json\",\"story_step\":" + step +
                ",\"language\":\"" + lang + "\",\"visual_profile\":\"XrealOstBright(global); guided-story player uses its own hardcoded palette + white labels and does NOT consume the token profile (finding)\"" +
                ",\"tracking_state\":\"" + tracking + "\",\"resolution\":\"" + W + "x" + H + "\",\"camera_pos\":\"" + cp.position.x.ToString("0.00") + "," + cp.position.y.ToString("0.00") + "," + cp.position.z.ToString("0.00") +
                "\",\"camera_bg\":\"dark(0.035,0.045,0.065) — OST sims composite over real backgrounds\",\"font\":\"Hiragino Sans GB (dynamic OS, CJK-capable)\",\"timestamp_utc\":\"" + System.DateTime.UtcNow.ToString("o") + "\",\"device_validated\":false}");
        }

        void WriteManifest()
        {
            var sb = new StringBuilder();
            sb.Append("{\n  \"_comment\": \"V11 Unity review captures. NOT device evidence. device_validated=false on every entry. visual_profile note is an honest finding: the guided-story surface is not yet OST-token-aware.\",\n");
            sb.Append("  \"captures\": [\n    ");
            sb.Append(string.Join(",\n    ", _manifest));
            sb.Append("\n  ]\n}\n");
            File.WriteAllText(Path.Combine(OutDir, "capture-manifest.json"), sb.ToString());
        }
    }
}
#endif
