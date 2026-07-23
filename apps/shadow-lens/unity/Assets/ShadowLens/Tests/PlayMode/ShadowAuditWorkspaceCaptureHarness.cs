// apps/shadow-lens/unity/Assets/ShadowLens/Tests/PlayMode/ShadowAuditWorkspaceCaptureHarness.cs
// PlayMode graphical capture of the REAL ShadowAuditWorkspace runtime component (not a mock). Renders
// the full 14-state matrix in DesktopDark, plus representative states in Simplified Chinese and in the
// XrealOstBright (SIMULATED) + AccessibilityHighContrast profiles. Deterministic naming
// <state>__<lang>__<profile>.png. NOT device evidence (device_validated=false). Env-gated by
// SHADOW_CAPTURE=1. Naming/state matrix documented in AUDIT_WORKSPACE_CAPTURE_MANIFEST.json.
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
        static StoryScenario Scenario(string review, string approval)
        {
            var sc = new StoryScenario { Id = "s", FirstFailure = "decision" };
            sc.AffectedDownstream.Add("pricing");
            sc.EntityStatus["income"] = "VERIFIED"; sc.EntityStatus["dti"] = "VERIFIED";
            sc.EntityStatus["decision"] = "FIRST_FAILURE"; sc.EntityStatus["pricing"] = "AFFECTED_DOWNSTREAM";
            sc.DimensionStatus["HUMAN_REVIEW"] = review;
            sc.DimensionStatus["HUMAN_APPROVAL"] = approval;
            sc.DimensionStatus["TRUST_POSTURE"] = "SELF_SIGNED";
            return sc;
        }

        // (state, focusId, review, approval, tracking)
        static readonly (string state, string focus, string review, string approval, string tracking)[] STATES =
        {
            ("overview", "income", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", "TRACKED_3DOF"),
            ("current-focus", "dti", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", "TRACKED_3DOF"),
            ("source-card", "income", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", "TRACKED_3DOF"),
            ("trust-strip", "decision", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", "TRACKED_3DOF"),
            ("first-failure", "decision", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", "TRACKED_3DOF"),
            ("downstream-affected", "pricing", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", "TRACKED_3DOF"),
            ("human-review-required", "decision", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", "TRACKED_3DOF"),
            ("human-review-recorded", "decision", "HUMAN_REVIEW_RECORDED", "APPROVAL_NOT_PRESENT", "TRACKED_3DOF"),
            ("approval-not-present", "decision", "HUMAN_REVIEW_RECORDED", "APPROVAL_NOT_PRESENT", "TRACKED_3DOF"),
            ("approval-present", "decision", "HUMAN_REVIEW_RECORDED", "APPROVAL_PRESENT", "TRACKED_3DOF"),
            ("tracking-scanning", "decision", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", "SCANNING"),
            ("tracking-limited", "decision", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", "LIMITED"),
            ("tracking-lost", "decision", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", "LOST"),
            ("tracking-recovering", "decision", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", "RECOVERING"),
        };
        // representative critical states for extra language/profile coverage
        static readonly HashSet<string> REP = new HashSet<string> { "overview", "first-failure", "downstream-affected", "approval-present", "tracking-scanning", "tracking-lost" };

        [UnityTest]
        public IEnumerator CaptureAuditWorkspace()
        {
            if (System.Environment.GetEnvironmentVariable("SHADOW_CAPTURE") != "1")
            { Assert.Ignore("Workspace capture — set SHADOW_CAPTURE=1."); yield break; }
            Directory.CreateDirectory(OutDir);
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
            _cam.transform.position = new Vector3(0f, 0.1f, -7.2f); _cam.transform.LookAt(new Vector3(0f, 0.1f, 0f));
            _cam.fieldOfView = 40; _cam.clearFlags = CameraClearFlags.SolidColor;
            _cam.targetTexture = _rt;

            var wGo = new GameObject("AuditWorkspace");
            _ws = wGo.AddComponent<ShadowAuditWorkspace>();
            _ws.LabelFont = _cjk;
            var model = Model();

            var manifest = new List<string>();
            var profiles = new[] { P.DesktopDark, P.XrealOstBright, P.AccessibilityHighContrast };
            foreach (var st in STATES)
            {
                foreach (var prof in profiles)
                {
                    // DesktopDark: all 14 states. Other profiles: representative states only.
                    if (prof != P.DesktopDark && !REP.Contains(st.state)) continue;
                    bool[] langs = (prof == P.DesktopDark && REP.Contains(st.state)) || prof == P.DesktopDark
                        ? (REP.Contains(st.state) ? new[] { false, true } : new[] { false })
                        : new[] { false };
                    foreach (var zh in langs)
                    {
                        _cam.backgroundColor = prof == P.XrealOstBright ? new Color(0.78f, 0.80f, 0.83f)
                            : prof == P.AccessibilityHighContrast ? Color.black : new Color(0.043f, 0.059f, 0.086f);
                        _ws.Profile = prof; _ws.Zh = zh; _ws.Tracking = st.tracking;
                        _ws.BindDirect(model, Scenario(st.review, st.approval), st.focus);
                        string lang = zh ? "zh-CN" : "en";
                        string name = st.state + "__" + lang + "__" + prof;
                        yield return Shot(name);
                        manifest.Add("{\"state\":\"" + st.state + "\",\"language\":\"" + lang + "\",\"profile\":\"" + prof +
                            "\",\"focus\":\"" + st.focus + "\",\"review\":\"" + st.review + "\",\"approval\":\"" + st.approval +
                            "\",\"tracking\":\"" + st.tracking + "\",\"file\":\"" + name + ".png\",\"device_validated\":false}");
                    }
                }
            }
            File.WriteAllText(Path.Combine(OutDir, "harness-capture-list.json"), "[\n  " + string.Join(",\n  ", manifest) + "\n]\n");
            // sanity: DesktopDark en exists for every state
            foreach (var st in STATES)
            {
                var p = Path.Combine(OutDir, st.state + "__en__DesktopDark.png");
                Assert.IsTrue(File.Exists(p), "missing " + p);
                Assert.Greater(new FileInfo(p).Length, 3000, "small PNG: " + st.state);
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
