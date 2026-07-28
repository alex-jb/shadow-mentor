// apps/shadow-lens/unity/Assets/ShadowLens/Editor/GuidedStory/ShadowV10CoreBuild.cs
// Phase 10 CORE device candidate → Build/Android/shadow-lens-xreal-voice-v10-core.apk. Same real-SDK
// XREAL+Voice build as V8 but a DISTINCT output (never overwrites the V9 candidate) and it asserts the
// camera stays OFF (SHADOW_XREAL_CAMERA must NOT be defined). Requires the SDK + SHADOW_XREAL_SDK; fails
// honestly otherwise. CI: -executeMethod ShadowLens.EditorTools.ShadowV10CoreBuild.BuildCI. SOURCE AUTHORED.
#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace ShadowLens.EditorTools
{
    public static class ShadowV10CoreBuild
    {
        const string Pkg = "com.shadowlens.xrealvoice";
        const string OutApk = "Build/Android/shadow-lens-xreal-voice-v10-core.apk";

        [MenuItem("Shadow Lens/Build V10 Core Device Candidate")]
        public static void Menu() { Build(); }
        public static void BuildCI() { if (Build() != BuildResult.Succeeded) EditorApplication.Exit(1); }

        static BuildResult Build()
        {
            var defines = PlayerSettings.GetScriptingDefineSymbols(NamedBuildTarget.Android);
            if (!defines.Contains("SHADOW_XREAL_SDK"))
            {
                Debug.LogError("[V10Core] requires the official XREAL SDK 3.1.0 import + SHADOW_XREAL_SDK. See docs/UNITY_XREAL_BUILD_RUNBOOK.md. NOT building a placeholder.");
                return BuildResult.Failed;
            }
            if (defines.Contains("SHADOW_XREAL_CAMERA"))
            {
                Debug.LogError("[V10Core] SHADOW_XREAL_CAMERA must be OFF for the core candidate. Aborting.");
                return BuildResult.Failed;
            }
            // Delegate to the shared V8 builder (same real-SDK config, minSdk 29, stashes offline manifest),
            // but with the V10 core output path + package + version + banner.
            return ShadowV8AndroidBuild.BuildXrealNamed(Pkg, OutApk, "0.10-xreal-core", "reports/device-v10",
                "FIXTURE · V10 XREAL CORE · CAMERA OFF · DEVICE VALIDATION PENDING");
        }
    }
}
#endif
