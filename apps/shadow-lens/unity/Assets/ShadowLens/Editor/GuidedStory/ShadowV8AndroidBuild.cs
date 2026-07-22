// apps/shadow-lens/unity/Assets/ShadowLens/Editor/GuidedStory/ShadowV8AndroidBuild.cs
// Phase 8 candidates:
//   A. Base Voice   → Build/Android/shadow-lens-voice-v8-base.apk  (Android system TTS, NO XREAL SDK,
//      NO INTERNET/mic/camera/storage). Buildable without the SDK.
//   B. XREAL+Voice  → Build/Android/shadow-lens-xreal-voice-v8-candidate.apk (needs the official XREAL
//      SDK 3.1.0 + the SHADOW_XREAL_SDK define). If the SDK is absent this FAILS honestly — it never
//      produces a fake XREAL build. Neither candidate overwrites an existing APK.
// Menus under Shadow Lens/. CI methods: BuildBaseVoiceCI / BuildXrealVoiceCI. SOURCE AUTHORED.
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

namespace ShadowLens.EditorTools
{
    public static class ShadowV8AndroidBuild
    {
        [MenuItem("Shadow Lens/Build V8 Base Voice Candidate")]
        public static void BaseMenu() { BuildBase(); }
        public static void BuildBaseVoiceCI() { if (BuildBase() != BuildResult.Succeeded) EditorApplication.Exit(1); }

        [MenuItem("Shadow Lens/Build V8 XREAL+Voice Candidate")]
        public static void XrealMenu() { BuildXreal(); }
        public static void BuildXrealVoiceCI() { if (BuildXreal() != BuildResult.Succeeded) EditorApplication.Exit(1); }

        static BuildResult BuildBase()
        {
            return BuildOne("com.shadowlens.voice.base", "Build/Android/shadow-lens-voice-v8-base.apk",
                "0.8-voice-base", "reports/voice-v8", requireXreal: false, banner: "FIXTURE · V8 BASE VOICE · TTS-ONLY · DEVICE VALIDATION PENDING");
        }

        static BuildResult BuildXreal()
        {
            // The XREAL candidate REQUIRES the official SDK + define. Fail honestly if absent.
            var defines = PlayerSettings.GetScriptingDefineSymbols(NamedBuildTarget.Android);
            if (!defines.Contains("SHADOW_XREAL_SDK"))
            {
                Debug.LogError("[V8Build] XREAL+Voice candidate requires the official XREAL SDK 3.1.0 import + the SHADOW_XREAL_SDK define (Android). See docs/UNITY_XREAL_BUILD_RUNBOOK.md. NOT building a placeholder.");
                return BuildResult.Failed;
            }
            return BuildOne("com.shadowlens.xrealvoice", "Build/Android/shadow-lens-xreal-voice-v8-candidate.apk",
                "0.8-xreal-voice", "reports/voice-v8", requireXreal: true, banner: "FIXTURE · V8 XREAL+VOICE · DEVICE VALIDATION PENDING");
        }

        static BuildResult BuildOne(string pkg, string outApk, string ver, string reportDir, bool requireXreal, string banner)
        {
            var scene = BuildScene(banner);
            EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, pkg);
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel24;
            PlayerSettings.Android.targetSdkVersion = AndroidSdkVersions.AndroidApiLevel34;
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.SetIl2CppCompilerConfiguration(NamedBuildTarget.Android, Il2CppCompilerConfiguration.Release);
            PlayerSettings.Android.forceInternetPermission = false;   // + custom manifest strips INTERNET (base is offline)
            PlayerSettings.bundleVersion = ver;

            var proj = Directory.GetParent(Application.dataPath).FullName;
            var apkAbs = Path.GetFullPath(Path.Combine(proj, outApk));
            Directory.CreateDirectory(Path.GetDirectoryName(apkAbs));
            var opts = new BuildPlayerOptions { scenes = new[] { scene }, locationPathName = apkAbs, target = BuildTarget.Android, options = BuildOptions.DetailedBuildReport };
            var t0 = EditorApplication.timeSinceStartup;
            BuildReport report = BuildPipeline.BuildPlayer(opts);
            WriteReport(report, apkAbs, outApk, pkg, ver, requireXreal, EditorApplication.timeSinceStartup - t0, proj, reportDir);
            Debug.Log($"[V8Build] {report.summary.result} → {outApk} ({report.summary.totalSize} bytes)");
            if (report.summary.result != BuildResult.Succeeded) Debug.LogError("[V8Build] FAILED: " + report.summary.result);
            return report.summary.result;
        }

        static string BuildScene(string banner)
        {
            const string scenePath = "Assets/ShadowLens/Scenes/ShadowV8Demo.unity";
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var camGo = new GameObject("Main Camera"); var cam = camGo.AddComponent<Camera>(); cam.tag = "MainCamera"; cam.clearFlags = CameraClearFlags.SolidColor; cam.backgroundColor = new Color(0.043f, 0.051f, 0.063f); camGo.transform.position = new Vector3(0f, 0.3f, -4.6f); camGo.transform.LookAt(Vector3.zero);
            var light = new GameObject("Directional Light").AddComponent<Light>(); light.type = LightType.Directional; light.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
            var b = new GameObject("V8Banner").AddComponent<TextMesh>(); b.transform.position = new Vector3(0f, 1.9f, 0f); b.transform.localScale = Vector3.one * 0.035f; b.anchor = TextAnchor.MiddleCenter; b.color = new Color(0.98f, 0.75f, 0.14f); b.text = banner;
            var capGo = new GameObject("CapabilityBanner"); capGo.transform.position = new Vector3(0f, 1.6f, 0f); capGo.transform.localScale = Vector3.one * 0.05f; capGo.AddComponent<ShadowDeviceCapabilityBanner>();
            var playerGo = new GameObject("ShadowGuidedStoryPlayer"); var player = playerGo.AddComponent<ShadowGuidedStoryPlayer>(); player.Snapshots = ShadowGuidedStoryImporter.LoadSnapshotAssets();
            var presGo = new GameObject("ShadowPresenter"); var pres = presGo.AddComponent<ShadowPresenterController>(); pres.Player = player;
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(Path.Combine(Application.dataPath, "..", scenePath))));
            EditorSceneManager.SaveScene(scene, scenePath);
            return scenePath;
        }

        static void WriteReport(BuildReport report, string apkAbs, string outApk, string pkg, string ver, bool xreal, double dur, string proj, string reportDir)
        {
            var dir = Path.Combine(Path.GetFullPath(Path.Combine(proj, "..", "..", "..")), reportDir);
            Directory.CreateDirectory(dir);
            string sha = "(none)"; long size = 0;
            if (File.Exists(apkAbs)) { size = new FileInfo(apkAbs).Length; using (var s = File.OpenRead(apkAbs)) using (var h = SHA256.Create()) sha = BitConverter.ToString(h.ComputeHash(s)).Replace("-", "").ToLowerInvariant(); }
            var name = xreal ? "xreal-voice" : "base-voice";
            var sb = new StringBuilder();
            sb.Append("# V8 ").Append(name).Append(" candidate — build report\n\n");
            sb.Append("result: ").Append(report.summary.result).Append('\n');
            sb.Append("apk: ").Append(outApk).Append("\napk_bytes: ").Append(size).Append("\napk_sha256: ").Append(sha).Append('\n');
            sb.Append("package_id: ").Append(pkg).Append("\nbundle_version: ").Append(ver).Append('\n');
            sb.Append("unity_version: ").Append(Application.unityVersion).Append("\nscripting_backend: IL2CPP\narchitectures: ARM64\nmin_sdk: 24  target_sdk: 34\n");
            sb.Append("xreal_sdk_required: ").Append(xreal ? "yes" : "no").Append('\n');
            sb.Append("mode: ").Append(xreal ? "XREAL + Voice" : "TTS-only base (no INTERNET/mic/camera)").Append('\n');
            sb.Append("build_duration_sec: ").Append(dur.ToString("F1")).Append("\ntotal_warnings: ").Append(report.summary.totalWarnings).Append('\n');
            File.WriteAllText(Path.Combine(dir, name.ToUpperInvariant().Replace('-', '_') + "_BUILD_REPORT.md"), sb.ToString());
            File.WriteAllText(Path.Combine(dir, name + "-APK_SHA256.txt"), sha + "  " + outApk + "\n");
        }
    }
}
#endif
