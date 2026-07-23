// apps/shadow-lens/unity/Assets/ShadowLens/Tests/PlayMode/ShadowAuditWorkspaceCaptureHarness.cs
// PlayMode graphical capture of the REAL ShadowAuditWorkspace runtime component (not a mock). Builds a
// sanitized Banking model in-code, instantiates the workspace, binds it, and renders deterministic
// offscreen PNGs for visual acceptance. NOT device evidence (device_validated=false). Env-gated behind
// SHADOW_CAPTURE=1 so the normal PlayMode suite is unaffected.
//   SHADOW_CAPTURE=1 Unity -batchmode -runTests -testPlatform PlayMode -testFilter ".*AuditWorkspaceCapture.*" ...
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
    public class ShadowAuditWorkspaceCaptureHarness
    {
        const int W = 1600, H = 1000;
        static string OutDir => Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", "..", "..", "media", "spatial-ux-v11", "audit-workspace"));
        Camera _cam; RenderTexture _rt; ShadowAuditWorkspace _ws; Font _cjk;

        static GuidedStorySemantic Model()
        {
            var m = new GuidedStorySemantic { StoryId = "banking", Title = new Bilingual { En = "Banking Audit", Zh = "银行审计" } };
            m.Entities.Add(new StoryEntity { Id = "income", Kind = "record", Sequence = 1, Label = new Bilingual { En = "Income", Zh = "收入" }, EvidenceRef = "ev.income" });
            m.Entities.Add(new StoryEntity { Id = "dti", Kind = "record", Sequence = 2, Label = new Bilingual { En = "DTI", Zh = "债务收入比" }, EvidenceRef = "ev.dti" });
            m.Entities.Add(new StoryEntity { Id = "decision", Kind = "decision", Sequence = 3, Label = new Bilingual { En = "Council Decision", Zh = "委员会决策" }, EvidenceRef = null });
            m.Entities.Add(new StoryEntity { Id = "pricing", Kind = "record", Sequence = 4, Label = new Bilingual { En = "Pricing Tier", Zh = "定价档位" }, EvidenceRef = "ev.pricing" });
            return m;
        }
        static StoryScenario Scenario()
        {
            var sc = new StoryScenario { Id = "s", FirstFailure = "decision" };
            sc.AffectedDownstream.Add("pricing");
            sc.EntityStatus["income"] = "VERIFIED"; sc.EntityStatus["dti"] = "VERIFIED";
            sc.EntityStatus["decision"] = "FIRST_FAILURE"; sc.EntityStatus["pricing"] = "AFFECTED_DOWNSTREAM";
            sc.DimensionStatus["HUMAN_REVIEW"] = "REQUIRES_HUMAN_REVIEW";
            sc.DimensionStatus["HUMAN_APPROVAL"] = "APPROVAL_NOT_PRESENT";
            sc.DimensionStatus["TRUST_POSTURE"] = "SELF_SIGNED";
            return sc;
        }

        [UnityTest]
        public IEnumerator CaptureAuditWorkspace()
        {
            if (System.Environment.GetEnvironmentVariable("SHADOW_CAPTURE") != "1")
            { Assert.Ignore("Workspace capture — set SHADOW_CAPTURE=1."); yield break; }
            Directory.CreateDirectory(OutDir);
            // remove AutoBoot-injected experiences so the workspace capture isn't polluted by a stray case sphere/ring
            yield return null;
            foreach (var stg in Object.FindObjectsByType<ShadowLens.Narrative.ShadowStageController>(FindObjectsSortMode.None)) Object.Destroy(stg.transform.root.gameObject);
            foreach (var bs in Object.FindObjectsByType<ShadowLens.Bootstrap.ShadowLensRuntimeBootstrap>(FindObjectsSortMode.None)) Object.Destroy(bs.transform.root.gameObject);
            yield return null;
            _cjk = Font.CreateDynamicFontFromOSFont(new[] { "Hiragino Sans GB", "STHeiti", "PingFang SC", "Arial Unicode MS" }, 64);

            var light = new GameObject("DirLight").AddComponent<Light>();
            light.type = LightType.Directional; light.intensity = 1.0f; light.transform.rotation = Quaternion.Euler(50, -30, 0);
            RenderSettings.ambientLight = new Color(0.7f, 0.72f, 0.75f);

            _rt = new RenderTexture(W, H, 24, RenderTextureFormat.ARGB32);
            var camGo = new GameObject("CaptureCam"); camGo.tag = "MainCamera";
            _cam = camGo.AddComponent<Camera>();
            _cam.transform.position = new Vector3(0f, 0.15f, -7.0f); _cam.transform.LookAt(new Vector3(0f, 0.15f, 0f));
            _cam.fieldOfView = 40; _cam.clearFlags = CameraClearFlags.SolidColor;
            _cam.backgroundColor = new Color(0.043f, 0.059f, 0.086f);
            _cam.targetTexture = _rt;

            var wGo = new GameObject("AuditWorkspace");
            _ws = wGo.AddComponent<ShadowAuditWorkspace>();
            _ws.Profile = P.DesktopDark; _ws.LabelFont = _cjk;

            var model = Model(); var sc = Scenario();

            _ws.BindDirect(model, sc, "income");
            yield return Shot("01-overview-en");

            _ws.FocusOn("decision");
            yield return Shot("02-first-failure-en");

            _ws.FocusOn("pricing");
            yield return Shot("03-downstream-affected-en");

            _ws.FocusOn("decision"); _ws.SetTracking("SCANNING");
            yield return Shot("04-tracking-scanning-en");

            _ws.SetTracking("LOST");
            yield return Shot("05-tracking-lost-en");

            _ws.SetTracking("TRACKED_3DOF"); _ws.SetZh(true); _ws.FocusOn("income");
            yield return Shot("06-overview-zh");

            _ws.FocusOn("decision");
            yield return Shot("07-first-failure-zh");

            foreach (var n in new[] { "01-overview-en", "02-first-failure-en", "03-downstream-affected-en", "04-tracking-scanning-en", "05-tracking-lost-en", "06-overview-zh", "07-first-failure-zh" })
            {
                var p = Path.Combine(OutDir, n + ".png");
                Assert.IsTrue(File.Exists(p), "missing " + p);
                Assert.Greater(new FileInfo(p).Length, 3000, "suspiciously small PNG: " + n);
            }
        }

        IEnumerator Shot(string name)
        {
            yield return null; yield return null;
            _cam.Render();
            var prev = RenderTexture.active; RenderTexture.active = _rt;
            var tex = new Texture2D(W, H, TextureFormat.RGBA32, false);
            tex.ReadPixels(new Rect(0, 0, W, H), 0, 0); tex.Apply();
            RenderTexture.active = prev;
            File.WriteAllBytes(Path.Combine(OutDir, name + ".png"), tex.EncodeToPNG());
            Object.Destroy(tex);
        }
    }
}
#endif
