// apps/shadow-lens/unity/Assets/ShadowLens/Editor/ShadowV11BeamProCandidate.cs
// V11 Beam Pro device candidate → Build/Android/shadow-lens-v11-beampro-candidate-01.apk. Builds a
// scene whose default view is the REAL ShadowAuditWorkspace (device bootstrap), NOT the guided-story
// player. DISTINCT output (never overwrites the stable v10-core APK), distinct versionName. Requires
// the official XREAL SDK (SHADOW_XREAL_SDK) + camera OFF (SHADOW_XREAL_CAMERA must NOT be defined);
// fails honestly otherwise. CI: -executeMethod ShadowLens.EditorTools.ShadowV11BeamProCandidate.BuildCI.
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
using ShadowLens.Workspace;

namespace ShadowLens.EditorTools
{
    public static class ShadowV11BeamProCandidate
    {
        const string Pkg = "com.shadowlens.xrealvoice";               // kept — XREAL loader depends on it
        const string OutApk = "Build/Android/shadow-lens-v11-beampro-candidate-01.apk";
        const string Ver = "0.11-beampro-candidate.1";
        const int VerCode = 111;                                       // > prior candidates

        [MenuItem("Shadow Lens/Build V11 Beam Pro Candidate")]
        public static void Menu() { Build(); }
        public static void BuildCI() { if (Build() != BuildResult.Succeeded) EditorApplication.Exit(1); }

        static BuildResult Build()
        {
            var defines = PlayerSettings.GetScriptingDefineSymbols(NamedBuildTarget.Android);
            if (!defines.Contains("SHADOW_XREAL_SDK"))
            {
                Debug.LogError("[V11BeamPro] requires the official XREAL SDK import + SHADOW_XREAL_SDK. " +
                    "Current define symbols do not contain it — import the SDK per docs/UNITY_XREAL_BUILD_RUNBOOK.md. NOT building a placeholder.");
                return BuildResult.Failed;
            }
            if (defines.Contains("SHADOW_XREAL_CAMERA"))
            {
                Debug.LogError("[V11BeamPro] SHADOW_XREAL_CAMERA must be OFF for the first device candidate. Aborting.");
                return BuildResult.Failed;
            }

            var scene = BuildScene();
            EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, Pkg);
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel29; // XREAL AARs need 29
            PlayerSettings.Android.targetSdkVersion = AndroidSdkVersions.AndroidApiLevel34;
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.SetIl2CppCompilerConfiguration(NamedBuildTarget.Android, Il2CppCompilerConfiguration.Release);
            PlayerSettings.bundleVersion = Ver;
            PlayerSettings.Android.bundleVersionCode = VerCode;

            var proj = Directory.GetParent(Application.dataPath).FullName;
            var apkAbs = Path.GetFullPath(Path.Combine(proj, OutApk));
            Directory.CreateDirectory(Path.GetDirectoryName(apkAbs));
            var opts = new BuildPlayerOptions { scenes = new[] { scene }, locationPathName = apkAbs, target = BuildTarget.Android, options = BuildOptions.DetailedBuildReport };
            var t0 = EditorApplication.timeSinceStartup;
            BuildReport report = BuildPipeline.BuildPlayer(opts);
            WriteReport(report, apkAbs, proj, EditorApplication.timeSinceStartup - t0);
            Debug.Log($"[V11BeamPro] {report.summary.result} → {OutApk} ({report.summary.totalSize} bytes)");
            return report.summary.result;
        }

        static string BuildScene()
        {
            const string scenePath = "Assets/ShadowLens/Scenes/ShadowV11BeamPro.unity";
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var camGo = new GameObject("Main Camera");
            var cam = camGo.AddComponent<Camera>(); cam.tag = "MainCamera";
            cam.clearFlags = CameraClearFlags.SolidColor; cam.backgroundColor = Color.black; // black → transparent on OST
            camGo.transform.position = new Vector3(0f, 0.1f, -7.0f); camGo.transform.LookAt(new Vector3(0f, 0.1f, 0f));
            var light = new GameObject("Directional Light").AddComponent<Light>();
            light.type = LightType.Directional; light.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
            // default view = the real Audit Workspace via the device bootstrap
            new GameObject("AuditWorkspaceBootstrap").AddComponent<ShadowAuditWorkspaceDeviceBootstrap>();
            var b = new GameObject("CandidateBanner").AddComponent<TextMesh>();
            b.transform.position = new Vector3(0f, 2.1f, 0f); b.transform.localScale = Vector3.one * 0.03f; b.anchor = TextAnchor.MiddleCenter;
            b.color = new Color(0.98f, 0.75f, 0.14f); b.text = "V11 BEAM PRO CANDIDATE · CAMERA OFF · DEVICE VALIDATION PENDING";
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(Path.Combine(Application.dataPath, "..", scenePath))));
            EditorSceneManager.SaveScene(scene, scenePath);
            return scenePath;
        }

        static void WriteReport(BuildReport report, string apkAbs, string proj, double dur)
        {
            var dir = Path.Combine(Path.GetFullPath(Path.Combine(proj, "..", "..", "..")), "reports/device-validation-v11/build");
            Directory.CreateDirectory(dir);
            string sha = "(none)"; long size = 0;
            if (File.Exists(apkAbs)) { size = new FileInfo(apkAbs).Length; using var s = File.OpenRead(apkAbs); using var h = SHA256.Create(); sha = BitConverter.ToString(h.ComputeHash(s)).Replace("-", "").ToLowerInvariant(); }
            var sb = new StringBuilder();
            sb.Append("{\n");
            sb.Append($"  \"result\": \"{report.summary.result}\",\n");
            sb.Append($"  \"apk\": \"{OutApk}\",\n");
            sb.Append($"  \"package_id\": \"{Pkg}\",\n  \"versionName\": \"{Ver}\",\n  \"versionCode\": {VerCode},\n");
            sb.Append("  \"minSdk\": 29,\n  \"targetSdk\": 34,\n  \"abi\": \"ARM64\",\n  \"scripting\": \"IL2CPP\",\n");
            sb.Append("  \"camera_flag\": \"OFF\",\n  \"eye_flag\": \"OFF\",\n  \"production_signed\": false,\n");
            sb.Append($"  \"unity\": \"{Application.unityVersion}\",\n  \"size_bytes\": {size},\n  \"sha256\": \"{sha}\",\n");
            sb.Append($"  \"build_seconds\": {dur:F1},\n  \"default_view\": \"ShadowAuditWorkspace (device bootstrap)\"\n");
            sb.Append("}\n");
            File.WriteAllText(Path.Combine(dir, "build-summary.json"), sb.ToString());
            File.WriteAllText(Path.Combine(dir, "candidate-apk-sha256.txt"), sha + "  " + OutApk + "\n");
        }
    }
}
#endif
