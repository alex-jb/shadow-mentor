// apps/shadow-lens/unity/Assets/ShadowLens/Editor/GuidedStory/ShadowGuidedStoryAndroidBuild.cs
// Builds the GUIDED-STORY Android candidate — a NEW artifact that never overwrites the stable mock
// APK. Assembles a deterministic scene (camera + capability banner + guided-story player wired to the
// three pre-compiled snapshots + presenter + input router/bridge), configures Android/ARM64/IL2CPP,
// builds, then writes a build report + SHA-256. The base candidate does NOT require the XREAL SDK.
// Menu: Shadow Lens/Build Guided Story Android Candidate. CI: -executeMethod
// ShadowLens.EditorTools.ShadowGuidedStoryAndroidBuild.BuildCI. SOURCE AUTHORED.
#if UNITY_EDITOR
using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using ShadowLens.Device;
using ShadowLens.GuidedStory;
using ShadowLens.Presenter;
using ShadowLens.InputV5.Runtime;

namespace ShadowLens.EditorTools
{
    public static class ShadowGuidedStoryAndroidBuild
    {
        const string Package = "com.shadowlens.guidedstory";
        const string OutApk = "Build/Android/shadow-lens-guided-story-v5-candidate.apk";
        const string ScenePath = "Assets/ShadowLens/Scenes/ShadowGuidedStoryDemo.unity";
        const string ReportDir = "reports/device-ready-v5";

        [MenuItem("Shadow Lens/Build Guided Story Android Candidate")]
        public static void BuildMenu() { Build(); }

        public static void BuildCI() { if (Build() != BuildResult.Succeeded) EditorApplication.Exit(1); }

        static BuildResult Build()
        {
            var scene = BuildScene();
            Configure();
            var proj = Directory.GetParent(Application.dataPath).FullName;   // apps/shadow-lens/unity
            var apkAbs = Path.GetFullPath(Path.Combine(proj, OutApk));
            Directory.CreateDirectory(Path.GetDirectoryName(apkAbs));

            // Default = RELEASE candidate: non-debuggable, least-privilege (no auto INTERNET), for the
            // demo. Set SHADOW_DEV_BUILD=1 for a separate Development build (debuggable + INTERNET) that
            // on-device profiling requires — the two are distinct artifacts, never the same APK.
            bool dev = System.Environment.GetEnvironmentVariable("SHADOW_DEV_BUILD") == "1";
            var buildOpts = BuildOptions.DetailedBuildReport | (dev ? BuildOptions.Development : BuildOptions.None);
            var opts = new BuildPlayerOptions
            {
                scenes = new[] { scene },
                locationPathName = apkAbs,
                target = BuildTarget.Android,
                options = buildOpts,
            };
            var t0 = EditorApplication.timeSinceStartup;
            BuildReport report = BuildPipeline.BuildPlayer(opts);
            double durationSec = EditorApplication.timeSinceStartup - t0;

            WriteReport(report, apkAbs, durationSec);
            Debug.Log($"[GuidedStoryBuild] {report.summary.result} → {OutApk} ({report.summary.totalSize} bytes, {durationSec:F1}s)");
            if (report.summary.result != BuildResult.Succeeded) Debug.LogError("[GuidedStoryBuild] FAILED: " + report.summary.result);
            return report.summary.result;
        }

        static void Configure()
        {
            EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, Package);
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel24;
            PlayerSettings.Android.targetSdkVersion = AndroidSdkVersions.AndroidApiLevel34;
            // IL2CPP is MANDATORY for ARM64 (Mono cannot target ARM64) — official Unity docs.
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.SetIl2CppCompilerConfiguration(NamedBuildTarget.Android, Il2CppCompilerConfiguration.Release);
            // Least privilege: the base candidate needs NO network, NO camera, NO microphone.
            PlayerSettings.Android.forceInternetPermission = false;
            PlayerSettings.Android.forceSDCardPermission = false;
            PlayerSettings.bundleVersion = "0.5-guided-story-candidate";
            // The base candidate does not depend on the XREAL SDK.
            var defines = PlayerSettings.GetScriptingDefineSymbols(NamedBuildTarget.Android);
            if (defines.Contains("SHADOW_XREAL_SDK"))
                Debug.LogWarning("[GuidedStoryBuild] SHADOW_XREAL_SDK is set — the base candidate is meant to build WITHOUT it.");
        }

        // Assemble the scene deterministically and save it.
        static string BuildScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var camGo = new GameObject("Main Camera");
            var cam = camGo.AddComponent<Camera>();
            cam.tag = "MainCamera";
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.043f, 0.051f, 0.063f);
            camGo.transform.position = new Vector3(0f, 0.3f, -4.6f);
            camGo.transform.LookAt(Vector3.zero);

            var light = new GameObject("Directional Light").AddComponent<Light>();
            light.type = LightType.Directional;
            light.transform.rotation = Quaternion.Euler(50f, -30f, 0f);

            // Capability banner (world-space TextMesh — uGUI/TextMesh is the correct world-space path).
            var bannerGo = new GameObject("CapabilityBanner");
            bannerGo.transform.position = new Vector3(0f, 1.6f, 0f);
            bannerGo.transform.localScale = Vector3.one * 0.05f;
            var banner = bannerGo.AddComponent<ShadowDeviceCapabilityBanner>();

            var fixtureBanner = new GameObject("FixtureBanner").AddComponent<TextMesh>();
            fixtureBanner.transform.position = new Vector3(0f, 1.9f, 0f);
            fixtureBanner.transform.localScale = Vector3.one * 0.04f;
            fixtureBanner.anchor = TextAnchor.MiddleCenter;
            fixtureBanner.color = new Color(0.98f, 0.75f, 0.14f);
            fixtureBanner.text = "FIXTURE · DEVICE VALIDATION PENDING";

            // Player wired to the three pre-compiled snapshots.
            var playerGo = new GameObject("ShadowGuidedStoryPlayer");
            var player = playerGo.AddComponent<ShadowGuidedStoryPlayer>();
            player.Snapshots = ShadowGuidedStoryImporter.LoadSnapshotAssets();

            // Presenter (deterministic Banking READY + failure recovery).
            var presenterGo = new GameObject("ShadowPresenter");
            var presenter = presenterGo.AddComponent<ShadowPresenterController>();
            presenter.Player = player;
            presenter.Banner = banner;

            // Input router + bridge to the presenter.
            var inputGo = new GameObject("ShadowInput");
            inputGo.AddComponent<ShadowInputRouterBehaviour>();
            var bridge = inputGo.AddComponent<ShadowPresenterInputBridge>();
            bridge.Presenter = presenter;

            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(Path.Combine(Application.dataPath, "..", ScenePath))));
            EditorSceneManager.SaveScene(scene, ScenePath);
            return ScenePath;
        }

        static void WriteReport(BuildReport report, string apkAbs, double durationSec)
        {
            var proj = Directory.GetParent(Application.dataPath).FullName;
            var repoRoot = Path.GetFullPath(Path.Combine(proj, "..", "..", ".."));   // apps/shadow-lens/unity → repo root
            var dir = Path.Combine(repoRoot, ReportDir);
            Directory.CreateDirectory(dir);

            string sha = "(apk-not-produced)";
            long size = 0;
            if (File.Exists(apkAbs))
            {
                size = new FileInfo(apkAbs).Length;
                using (var s = File.OpenRead(apkAbs)) using (var h = SHA256.Create())
                    sha = BitConverter.ToString(h.ComputeHash(s)).Replace("-", "").ToLowerInvariant();
            }

            var warnings = report.summary.totalWarnings;
            var errors = report.summary.totalErrors;
            var sb = new StringBuilder();
            sb.Append("# Guided Story Android Candidate — Build Report\n\n");
            sb.Append("result: ").Append(report.summary.result).Append('\n');
            sb.Append("apk: ").Append(OutApk).Append('\n');
            sb.Append("apk_bytes: ").Append(size).Append('\n');
            sb.Append("apk_sha256: ").Append(sha).Append('\n');
            sb.Append("package_id: ").Append(Package).Append('\n');
            sb.Append("bundle_version: ").Append(PlayerSettings.bundleVersion).Append('\n');
            sb.Append("unity_version: ").Append(Application.unityVersion).Append('\n');
            sb.Append("scripting_backend: IL2CPP\n");
            sb.Append("architectures: ARM64\n");
            sb.Append("min_sdk: 24  target_sdk: 34\n");
            sb.Append("build_duration_sec: ").Append(durationSec.ToString("F1")).Append('\n');
            sb.Append("total_warnings: ").Append(warnings).Append('\n');
            sb.Append("total_errors: ").Append(errors).Append('\n');
            sb.Append("xreal_sdk_required: false\n");
            sb.Append("network_required: false\n\n");
            sb.Append("## Build steps\n");
            foreach (var step in report.steps)
                sb.Append("- ").Append(step.name).Append(" (").Append(step.duration.TotalSeconds.ToString("F1")).Append("s)\n");
            File.WriteAllText(Path.Combine(dir, "ANDROID_BUILD_REPORT.md"), sb.ToString());
            File.WriteAllText(Path.Combine(dir, "APK_SHA256.txt"), sha + "  " + OutApk + "\n");
            Debug.Log("[GuidedStoryBuild] report → " + Path.Combine(ReportDir, "ANDROID_BUILD_REPORT.md"));
        }
    }
}
#endif
