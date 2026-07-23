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
        const string OutApk = "Build/Android/shadow-lens-v11-beampro-candidate-03.apk";
        const string Ver = "0.11-beampro-candidate.3";
        const int VerCode = 113;                                       // > candidate-02 (112)
        const string ProductName = "Shadow Lens";

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
            PlayerSettings.productName = ProductName;                   // application-label = "Shadow Lens"
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

            // ROOT CAUSE of candidate-01 not launching: the offline base manifest
            // (Assets/Plugins/Android/AndroidManifest.xml) only strips INTERNET + declares <application>
            // with NO launcher activity, so it REPLACES Unity's default launcher manifest and the MAIN/
            // LAUNCHER intent-filter + exported=true are lost. The XREAL candidate is NOT the offline
            // build (XREAL AARs need INTERNET), so stash that manifest → Unity generates its default
            // launcher manifest (UnityPlayerActivity + MAIN/LAUNCHER + exported=true). Same fix the V8/V10
            // XREAL builds use; a post-build aapt assertion below hard-fails if the APK is not launchable.
            string offlineManifest = Path.GetFullPath(Path.Combine(Application.dataPath, "Plugins/Android/AndroidManifest.xml"));
            string stashed = offlineManifest + ".xrealbuild-disabled";
            bool moved = false;
            if (File.Exists(offlineManifest)) { if (File.Exists(stashed)) File.Delete(stashed); File.Move(offlineManifest, stashed); moved = true; }
            BuildReport report;
            var t0 = EditorApplication.timeSinceStartup;
            try { report = BuildPipeline.BuildPlayer(new BuildPlayerOptions { scenes = new[] { scene }, locationPathName = apkAbs, target = BuildTarget.Android, options = BuildOptions.DetailedBuildReport }); }
            finally { if (moved && File.Exists(stashed)) { if (File.Exists(offlineManifest)) File.Delete(offlineManifest); File.Move(stashed, offlineManifest); } }
            WriteReport(report, apkAbs, proj, EditorApplication.timeSinceStartup - t0);
            Debug.Log($"[V11BeamPro] {report.summary.result} → {OutApk} ({report.summary.totalSize} bytes)");
            if (report.summary.result != BuildResult.Succeeded) return report.summary.result;

            // Mandatory post-build launchability assertion against the FINAL APK (aapt2 badging).
            if (!AssertLaunchable(apkAbs, proj))
            {
                Debug.LogError("[V11BeamPro] POST-BUILD ASSERTION FAILED — the APK is not launchable. Build rejected.");
                return BuildResult.Failed;
            }
            return report.summary.result;
        }

        // Shell out to aapt2 dump badging and assert the FINAL APK is launchable + correctly stamped.
        static bool AssertLaunchable(string apkAbs, string proj)
        {
            string aapt2 = FindAapt2();
            if (aapt2 == null) { Debug.LogError("[V11BeamPro] aapt2 not found — cannot verify launchability."); return false; }
            string outp;
            try
            {
                var psi = new System.Diagnostics.ProcessStartInfo(aapt2, $"dump badging \"{apkAbs}\"")
                { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true };
                using var p = System.Diagnostics.Process.Start(psi);
                outp = p.StandardOutput.ReadToEnd() + "\n" + p.StandardError.ReadToEnd();
                p.WaitForExit();
            }
            catch (System.Exception e) { Debug.LogError("[V11BeamPro] aapt2 failed: " + e.Message); return false; }

            bool ok = true;
            void Req(bool cond, string msg) { if (!cond) { Debug.LogError("[V11BeamPro] ASSERT FAIL: " + msg); ok = false; } }
            Req(outp.Contains($"name='{Pkg}'"), $"package == {Pkg}");
            Req(outp.Contains($"versionName='{Ver}'"), $"versionName == {Ver}");
            Req(outp.Contains($"versionCode='{VerCode}'"), $"versionCode == {VerCode}");
            Req(outp.Contains($"application-label:'{ProductName}'"), $"application-label == {ProductName}");
            Req(outp.Contains("launchable-activity: name='com.unity3d.player.UnityPlayerActivity'"),
                "exactly one launchable-activity == com.unity3d.player.UnityPlayerActivity (MAIN+LAUNCHER+exported present)");
            // exactly one launchable-activity line
            int n = 0, idx = 0; while ((idx = outp.IndexOf("launchable-activity:", idx, System.StringComparison.Ordinal)) >= 0) { n++; idx += 20; }
            Req(n == 1, $"exactly one launchable-activity (found {n})");

            // MyGlasses MR-registration assertions — meta-data (aapt2 dump xmltree) + XREAL native lib (zip).
            string tree = Aapt2(aapt2, $"dump xmltree \"{apkAbs}\" --file AndroidManifest.xml");
            Req(tree.Contains("com.nreal.supportDevices"), "manifest meta-data com.nreal.supportDevices present (MyGlasses MR registration)");
            Req(tree.Contains("nreal_sdk"), "manifest meta-data nreal_sdk present");
            bool xrealLib = false;
            try { using var z = System.IO.Compression.ZipFile.OpenRead(apkAbs); foreach (var e in z.Entries) if (e.FullName.Contains("libXREALXRPlugin.so") || e.FullName.Contains("libnr_loader.so")) { xrealLib = true; break; } } catch { }
            Req(xrealLib, "XREAL native library (libXREALXRPlugin.so / libnr_loader.so) present");

            var dir = Path.Combine(Path.GetFullPath(Path.Combine(proj, "..", "..", "..")), "reports/device-validation-v11/build");
            Directory.CreateDirectory(dir);
            File.WriteAllText(Path.Combine(dir, "candidate-03-aapt-badging.txt"), outp);
            File.WriteAllText(Path.Combine(dir, "candidate-03-manifest-metadata.txt"), ExtractMeta(tree));
            Debug.Log($"[V11BeamPro] launchability + MR-registration assertion {(ok ? "PASSED" : "FAILED")}");
            return ok;
        }

        static string Aapt2(string aapt2, string args)
        {
            try
            {
                var psi = new System.Diagnostics.ProcessStartInfo(aapt2, args) { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true };
                using var p = System.Diagnostics.Process.Start(psi);
                var o = p.StandardOutput.ReadToEnd(); p.WaitForExit(); return o;
            }
            catch { return ""; }
        }
        static string ExtractMeta(string xmltree)
        {
            var sb = new StringBuilder();
            foreach (var line in xmltree.Split('\n')) if (line.Contains("meta-data") || line.Contains("android:name") || line.Contains("android:value")) sb.AppendLine(line.Trim());
            return sb.ToString();
        }

        static string FindAapt2()
        {
            var roots = new[]
            {
                System.Environment.GetEnvironmentVariable("ANDROID_HOME"),
                Path.Combine(EditorApplication.applicationContentsPath, "PlaybackEngines/AndroidPlayer/SDK"),
                "/Applications/Unity/Hub/Editor/6000.0.23f1/PlaybackEngines/AndroidPlayer/SDK",
            };
            foreach (var r in roots)
            {
                if (string.IsNullOrEmpty(r)) continue;
                var bt = Path.Combine(r, "build-tools");
                if (!Directory.Exists(bt)) continue;
                foreach (var v in Directory.GetDirectories(bt))
                {
                    var cand = Path.Combine(v, "aapt2");
                    if (File.Exists(cand)) return cand;
                }
            }
            return null;
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
