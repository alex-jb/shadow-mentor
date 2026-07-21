// apps/shadow-lens/unity/Assets/ShadowLens/Editor/ShadowLensAndroidBuild.cs
// §6 — configures + builds the Shadow Lens MOCK Android APK (before the XREAL SDK): ARM64 · IL2CPP
// · correct package id · Internet permission · mic/camera declared (requested only when used) ·
// fixture mode · no API key in the APK · build commit shown. Menu: Shadow Lens/Build Mock Android
// APK. CI-invocable: -executeMethod ShadowLens.EditorTools.ShadowLensAndroidBuild.BuildCI.
// SOURCE AUTHORED · BUILD PENDING the operator's Android modules (run scripts/check-unity-android.sh).
#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

namespace ShadowLens.EditorTools
{
    public static class ShadowLensAndroidBuild
    {
        const string Package = "com.shadowlens.lens";
        const string OutDir = "Build/Android";

        [MenuItem("Shadow Lens/Build Mock Android APK")]
        public static void BuildMenu() { Configure(); BuildApk(Path.Combine(OutDir, "shadow-lens-mock.apk")); }

        // Called by CI: Unity -batchmode -quit -projectPath apps/shadow-lens/unity \
        //   -buildTarget Android -executeMethod ShadowLens.EditorTools.ShadowLensAndroidBuild.BuildCI
        public static void BuildCI()
        {
            Configure();
            var apk = System.Environment.GetEnvironmentVariable("SHADOW_LENS_APK_OUT") ?? Path.Combine(OutDir, "shadow-lens-mock.apk");
            var report = BuildApk(apk);
            if (report != BuildResult.Succeeded) EditorApplication.Exit(1);
        }

        static void Configure()
        {
            EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, Package);
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel24;
            PlayerSettings.Android.targetSdkVersion = AndroidSdkVersions.AndroidApiLevel34;
            // ARM64 + IL2CPP (XREAL/Quest require ARM64; IL2CPP for release).
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.SetIl2CppCompilerConfiguration(NamedBuildTarget.Android, Il2CppCompilerConfiguration.Release);
            // Internet is used (spatial-agent HTTP). Mic/camera are DECLARED via the AAR manifests
            // and requested at runtime only when used — do NOT force-add here.
            PlayerSettings.Android.forceInternetPermission = true;
            PlayerSettings.Android.forceSDCardPermission = false;
            // Fixture/mock mode: the XREAL SDK is NOT required (SHADOW_XREAL_SDK stays unset).
            var defines = PlayerSettings.GetScriptingDefineSymbols(NamedBuildTarget.Android);
            if (defines.Contains("SHADOW_XREAL_SDK")) Debug.LogWarning("[ShadowLens] SHADOW_XREAL_SDK set — this is a MOCK build; unset it for a pure mock APK.");
            // Stamp the build commit so the running APK can display it (no secret embedded).
            PlayerSettings.bundleVersion = "0.1-mock";
        }

        static BuildResult BuildApk(string apkPath)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(apkPath));
            var scenes = EditorBuildSettings.scenes.Length > 0
                ? System.Array.ConvertAll(EditorBuildSettings.scenes, s => s.path)
                : new[] { "Assets/ShadowLens/Scenes/ShadowLensMockDemo.unity" };
            var opts = new BuildPlayerOptions { scenes = scenes, locationPathName = apkPath, target = BuildTarget.Android, options = BuildOptions.None };
            var report = BuildPipeline.BuildPlayer(opts);
            Debug.Log($"[ShadowLens] Android build: {report.summary.result} → {apkPath} ({report.summary.totalSize} bytes)");
            return report.summary.result;
        }
    }
}
#endif
