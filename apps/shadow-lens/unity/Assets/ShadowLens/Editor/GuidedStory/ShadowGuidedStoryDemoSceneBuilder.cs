// apps/shadow-lens/unity/Assets/ShadowLens/Editor/GuidedStory/ShadowGuidedStoryDemoSceneBuilder.cs
// Builds a desktop demo scene for the guided-story player: a camera, an honest status banner
// (FIXTURE · DESKTOP MOCK · DEVICE VALIDATION PENDING), and a ShadowGuidedStoryPlayer wired to the
// three pre-compiled snapshots. Menu: Shadow Lens → Guided Story Demo. No XREAL SDK, no device
// assumptions — arrow keys / N,B,R,L,F drive it on desktop. SOURCE AUTHORED.
#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using ShadowLens.GuidedStory;

namespace ShadowLens.EditorTools
{
    public static class ShadowGuidedStoryDemoSceneBuilder
    {
        [MenuItem("Shadow Lens/Guided Story Demo")]
        public static void BuildDemoScene()
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

            var banner = new GameObject("StatusBanner").AddComponent<TextMesh>();
            banner.transform.position = new Vector3(0f, 1.5f, 0f);
            banner.transform.localScale = Vector3.one * 0.05f;
            banner.anchor = TextAnchor.MiddleCenter;
            banner.color = new Color(0.98f, 0.75f, 0.14f);
            banner.text = "FIXTURE · DESKTOP MOCK · DEVICE VALIDATION PENDING";

            var playerGo = new GameObject("ShadowGuidedStoryPlayer");
            var player = playerGo.AddComponent<ShadowGuidedStoryPlayer>();
            player.Snapshots = ShadowGuidedStoryImporter.LoadSnapshotAssets();

            Debug.Log($"[GuidedStory] demo scene built with {player.Snapshots.Count} stories. Arrow keys step; L=language, F=2D, R=restart.");
            EditorSceneManager.MarkSceneDirty(scene);
        }
    }
}
#endif
