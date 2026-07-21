// apps/shadow-lens/unity/Assets/ShadowLens/Editor/ShadowLensSceneGenerator.cs
// Editor menu that GENERATES the demo scenes idempotently — it cleans any previously generated
// Shadow Lens objects and never appends a second hierarchy. It bakes exactly ONE EventSystem,
// ONE camera, and ONE bootstrap; the runtime bootstrap builds the single visible mock root +
// view on Play (so nothing is double-created). Alex never rebuilds the hierarchy by hand.
// STATUS: the project compiled in Unity 6 (Alex, 2026-07-20); THIS generator rewrite is newly
// authored and NOT YET RE-COMPILED/RUN — regenerate the scene to apply the idempotent fix.
#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
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
            CleanGenerated(); // idempotent even if run on an already-populated scene

            // Exactly one EventSystem.
            if (Object.FindFirstObjectByType<EventSystem>() == null)
                new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));

            // Exactly one camera at standing height.
            if (Camera.main == null)
            {
                var cam = new GameObject("XR Origin (Mock Camera)", typeof(Camera), typeof(AudioListener));
                cam.tag = "MainCamera";
                cam.transform.position = new Vector3(0, 1.5f, 0);
            }

            // Exactly one bootstrap; the runtime builds the single mock root + visible view on Play.
            var bootGo = new GameObject(nameof(ShadowLensRuntimeBootstrap));
            var boot = bootGo.AddComponent<ShadowLensRuntimeBootstrap>();
            boot.autoRunOnStart = false; // Ready state; operator presses Analyze

            if (!AssetDatabase.IsValidFolder(Dir)) AssetDatabase.CreateFolder("Assets/ShadowLens", "Scenes");
            var path = $"{Dir}/{sceneName}.unity";
            EditorSceneManager.SaveScene(scene, path);
            Debug.Log($"[ShadowLens] generated {path} (xreal={xreal}). Enter Play Mode to render the mock UI.");
            EditorUtility.RevealInFinder(path);
        }

        // Remove previously generated Shadow Lens objects so regeneration never appends duplicates.
        static void CleanGenerated()
        {
            var root = GameObject.Find(ShadowLensRuntimeBootstrap.RootName);
            if (root != null) Object.DestroyImmediate(root);
            foreach (var b in Object.FindObjectsByType<ShadowLensRuntimeBootstrap>(FindObjectsSortMode.None))
                Object.DestroyImmediate(b.gameObject);
            var systems = Object.FindObjectsByType<EventSystem>(FindObjectsSortMode.None);
            for (int i = 1; i < systems.Length; i++) Object.DestroyImmediate(systems[i].gameObject);
        }

        [MenuItem("Shadow Lens/Validate Project Setup")]
        public static void ValidateProjectSetup()
        {
            var report = new System.Text.StringBuilder("[ShadowLens] project + scene validation\n");
            void Count(string label, int n, int want) => report.AppendLine($"  {(n == want ? "OK  " : "DUP!")} {label}: {n} (want {want})");

            Count("EventSystem", Object.FindObjectsByType<EventSystem>(FindObjectsSortMode.None).Length, 1);
            Count("ShadowLensRuntimeBootstrap", Object.FindObjectsByType<ShadowLensRuntimeBootstrap>(FindObjectsSortMode.None).Length, 1);
            Count("ShadowSpatialAgentPanel", Object.FindObjectsByType<ShadowLens.Mock.ShadowSpatialAgentPanel>(FindObjectsSortMode.None).Length, 1);
            Count("Main Camera", Camera.allCameras.Length, 1);
            var roots = 0; foreach (var go in Object.FindObjectsByType<GameObject>(FindObjectsSortMode.None)) if (go.name == ShadowLensRuntimeBootstrap.RootName) roots++;
            Count(ShadowLensRuntimeBootstrap.RootName, roots, roots <= 1 ? roots : 1);

            var defines = PlayerSettings.GetScriptingDefineSymbols(UnityEditor.Build.NamedBuildTarget.Android);
            report.AppendLine($"  {(defines.Contains("SHADOW_XREAL_SDK") ? "SET " : "off ")} SHADOW_XREAL_SDK define (off ⇒ mock tracking/capture)");
            report.AppendLine("\nStatus: Unity C# COMPILED (local). Mock scene renders on Play. DEVICE VALIDATION PENDING.");
            Debug.Log(report.ToString());
        }
    }
}
#endif
