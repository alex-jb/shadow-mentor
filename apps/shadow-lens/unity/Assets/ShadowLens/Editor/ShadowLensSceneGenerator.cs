// apps/shadow-lens/unity/Assets/ShadowLens/Editor/ShadowLensSceneGenerator.cs
// Editor menu commands that GENERATE the demo scenes + validate the project, so Alex never
// hand-reconstructs the hierarchy or hand-authors serialized .unity YAML. The scene is built
// from the same wiring as ShadowLensRuntimeBootstrap. SOURCE AUTHORED · NOT COMPILED (no Unity
// on the build host); these run once Unity opens the project.
#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using ShadowLens.Bootstrap;

namespace ShadowLens.EditorTools
{
    public static class ShadowLensSceneGenerator
    {
        const string Dir = "Assets/ShadowLens/Scenes";

        [MenuItem("Shadow Lens/Create Mock Demo Scene")]
        public static void CreateMockDemoScene() => Generate("ShadowLensMockDemo", xreal: false);

        [MenuItem("Shadow Lens/Create XREAL Demo Scene")]
        public static void CreateXrealDemoScene() => Generate("ShadowLensXrealDemo", xreal: true);

        static void Generate(string sceneName, bool xreal)
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            // Building the hierarchy at edit time reuses the runtime bootstrap so the two paths
            // never diverge. The bootstrap adds camera / event system / controller / roots.
            var go = new GameObject("ShadowLensRuntimeBootstrap");
            var boot = go.AddComponent<ShadowLensRuntimeBootstrap>();
            boot.autoRunOnStart = !xreal; // XREAL scene waits for the user to place the plane
            boot.BuildHierarchy();

            if (!AssetDatabase.IsValidFolder(Dir)) AssetDatabase.CreateFolder("Assets/ShadowLens", "Scenes");
            var path = $"{Dir}/{sceneName}.unity";
            EditorSceneManager.SaveScene(scene, path);
            Debug.Log($"[ShadowLens] generated {path} (xreal={xreal})");
            EditorUtility.RevealInFinder(path);
        }

        [MenuItem("Shadow Lens/Validate Project Setup")]
        public static void ValidateProjectSetup()
        {
            var report = new System.Text.StringBuilder("[ShadowLens] project validation\n");
            void Check(bool ok, string label) => report.AppendLine($"  {(ok ? "OK  " : "MISS")} {label}");

            Check(SystemInfo.supportsAsyncGPUReadback, "AsyncGPUReadback (Eye RGB readback path)");
            Check(PlayerSettings.Android.minSdkVersion >= AndroidSdkVersions.AndroidApiLevel24, "Android minSdk >= 24 (ML Kit / SpeechRecognizer)");
            var defines = PlayerSettings.GetScriptingDefineSymbols(UnityEditor.Build.NamedBuildTarget.Android);
            Check(defines.Contains("SHADOW_XREAL_SDK"), "SHADOW_XREAL_SDK define set (else mock tracking/capture)");
            Check(System.IO.Directory.Exists("Assets/Plugins/Android"), "Assets/Plugins/Android exists (drop the OCR/Voice .aar here)");

            report.AppendLine("\nStatus ladder: SOURCE AUTHORED / BUILD CONFIGURED / NOT COMPILED / DEVICE VALIDATION PENDING.");
            Debug.Log(report.ToString());
        }
    }
}
#endif
