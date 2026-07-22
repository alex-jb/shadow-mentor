// apps/shadow-lens/unity/Assets/ShadowLens/Editor/GuidedStory/ShadowVoiceAndroidBuild.cs
// Builds the Voice V2 Android candidate — a NEW artifact (com.shadowlens.voice) that includes the
// compiled VoiceV2 pipeline + the offline fixture/Android TTS providers. TTS-only: no microphone, no
// camera, no INTERNET (the custom main manifest strips INTERNET; speech-recognition + cloud modes are
// separate, not in this candidate). Reuses the guided-story scene. Menu: Shadow Lens/Build Voice V2
// Android Candidate. CI: -executeMethod ShadowLens.EditorTools.ShadowVoiceAndroidBuild.BuildCI.
// Status after a good build is ANDROID-VOICE-BUILT, never BEAM-PRO-TTS-VALIDATED. SOURCE AUTHORED.
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
    public static class ShadowVoiceAndroidBuild
    {
        const string Package = "com.shadowlens.voice";
        const string OutApk = "Build/Android/shadow-lens-voice-v7-candidate.apk";
        const string ScenePath = "Assets/ShadowLens/Scenes/ShadowVoiceDemo.unity";
        const string ReportDir = "reports/voice-v7";

        [MenuItem("Shadow Lens/Build Voice V2 Android Candidate")]
        public static void BuildMenu() { Build(); }
        public static void BuildCI() { if (Build() != BuildResult.Succeeded) EditorApplication.Exit(1); }

        static BuildResult Build()
        {
            var scene = BuildScene();
            EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, Package);
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel24;
            PlayerSettings.Android.targetSdkVersion = AndroidSdkVersions.AndroidApiLevel34;
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.SetIl2CppCompilerConfiguration(NamedBuildTarget.Android, Il2CppCompilerConfiguration.Release);
            PlayerSettings.Android.forceInternetPermission = false;   // + custom manifest strips INTERNET
            PlayerSettings.bundleVersion = "0.7-voice-candidate";

            var proj = Directory.GetParent(Application.dataPath).FullName;
            var apkAbs = Path.GetFullPath(Path.Combine(proj, OutApk));
            Directory.CreateDirectory(Path.GetDirectoryName(apkAbs));
            var opts = new BuildPlayerOptions { scenes = new[] { scene }, locationPathName = apkAbs, target = BuildTarget.Android, options = BuildOptions.DetailedBuildReport };
            var t0 = EditorApplication.timeSinceStartup;
            BuildReport report = BuildPipeline.BuildPlayer(opts);
            WriteReport(report, apkAbs, EditorApplication.timeSinceStartup - t0, proj);
            Debug.Log($"[VoiceBuild] {report.summary.result} → {OutApk} ({report.summary.totalSize} bytes)");
            if (report.summary.result != BuildResult.Succeeded) Debug.LogError("[VoiceBuild] FAILED: " + report.summary.result);
            return report.summary.result;
        }

        static string BuildScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var camGo = new GameObject("Main Camera");
            var cam = camGo.AddComponent<Camera>(); cam.tag = "MainCamera"; cam.clearFlags = CameraClearFlags.SolidColor; cam.backgroundColor = new Color(0.043f, 0.051f, 0.063f);
            camGo.transform.position = new Vector3(0f, 0.3f, -4.6f); camGo.transform.LookAt(Vector3.zero);
            var light = new GameObject("Directional Light").AddComponent<Light>(); light.type = LightType.Directional; light.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
            var banner = new GameObject("VoiceBanner").AddComponent<TextMesh>(); banner.transform.position = new Vector3(0f, 1.9f, 0f); banner.transform.localScale = Vector3.one * 0.04f; banner.anchor = TextAnchor.MiddleCenter; banner.color = new Color(0.98f, 0.75f, 0.14f); banner.text = "FIXTURE · VOICE V2 · TTS-ONLY · DEVICE VALIDATION PENDING";
            var capGo = new GameObject("CapabilityBanner"); capGo.transform.position = new Vector3(0f, 1.6f, 0f); capGo.transform.localScale = Vector3.one * 0.05f; capGo.AddComponent<ShadowDeviceCapabilityBanner>();
            var playerGo = new GameObject("ShadowGuidedStoryPlayer"); var player = playerGo.AddComponent<ShadowGuidedStoryPlayer>(); player.Snapshots = ShadowGuidedStoryImporter.LoadSnapshotAssets();
            var presGo = new GameObject("ShadowPresenter"); var pres = presGo.AddComponent<ShadowPresenterController>(); pres.Player = player;
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(Path.Combine(Application.dataPath, "..", ScenePath))));
            EditorSceneManager.SaveScene(scene, ScenePath);
            return ScenePath;
        }

        static void WriteReport(BuildReport report, string apkAbs, double durationSec, string proj)
        {
            var dir = Path.Combine(Path.GetFullPath(Path.Combine(proj, "..", "..", "..")), ReportDir);
            Directory.CreateDirectory(dir);
            string sha = "(none)"; long size = 0;
            if (File.Exists(apkAbs)) { size = new FileInfo(apkAbs).Length; using (var s = File.OpenRead(apkAbs)) using (var h = SHA256.Create()) sha = BitConverter.ToString(h.ComputeHash(s)).Replace("-", "").ToLowerInvariant(); }
            var sb = new StringBuilder();
            sb.Append("# Voice V2 Android Candidate — Build Report\n\n");
            sb.Append("result: ").Append(report.summary.result).Append('\n');
            sb.Append("apk: ").Append(OutApk).Append('\n');
            sb.Append("apk_bytes: ").Append(size).Append('\n');
            sb.Append("apk_sha256: ").Append(sha).Append('\n');
            sb.Append("package_id: ").Append(Package).Append('\n');
            sb.Append("bundle_version: ").Append(PlayerSettings.bundleVersion).Append('\n');
            sb.Append("unity_version: ").Append(Application.unityVersion).Append('\n');
            sb.Append("scripting_backend: IL2CPP\narchitectures: ARM64\nmin_sdk: 24  target_sdk: 34\n");
            sb.Append("mode: TTS-only (no microphone, no camera, no INTERNET)\n");
            sb.Append("build_duration_sec: ").Append(durationSec.ToString("F1")).Append('\n');
            sb.Append("total_warnings: ").Append(report.summary.totalWarnings).Append('\n');
            sb.Append("status: ANDROID-VOICE-BUILT (NOT BEAM-PRO-TTS-VALIDATED)\n");
            File.WriteAllText(Path.Combine(dir, "VOICE_BUILD_REPORT.md"), sb.ToString());
            File.WriteAllText(Path.Combine(dir, "APK_SHA256.txt"), sha + "  " + OutApk + "\n");
        }
    }
}
#endif
