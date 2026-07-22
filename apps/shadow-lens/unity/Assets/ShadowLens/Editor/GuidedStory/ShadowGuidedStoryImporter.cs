// apps/shadow-lens/unity/Assets/ShadowLens/Editor/GuidedStory/ShadowGuidedStoryImporter.cs
// Editor utility: load + validate the pre-compiled guided-story snapshots that ship under
// GuidedStory/Snapshots. It reuses the runtime loader (same fail-closed validation the device path
// uses), so a bad snapshot is caught in the Editor, not on a headset. SOURCE AUTHORED.
#if UNITY_EDITOR
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using ShadowLens.GuidedStory;

namespace ShadowLens.EditorTools
{
    public static class ShadowGuidedStoryImporter
    {
        public const string SnapshotFolder = "Assets/ShadowLens/GuidedStory/Snapshots";
        public static readonly string[] StoryIds = { "audit-chain", "reason-code-attestation", "persona-deliberation" };

        public static List<TextAsset> LoadSnapshotAssets()
        {
            var list = new List<TextAsset>();
            foreach (var id in StoryIds)
            {
                var path = $"{SnapshotFolder}/{id}.semantic.json";
                var asset = AssetDatabase.LoadAssetAtPath<TextAsset>(path);
                if (asset == null) Debug.LogWarning($"ShadowGuidedStoryImporter: missing snapshot {path}");
                else list.Add(asset);
            }
            return list;
        }

        [MenuItem("Shadow Lens/Validate Guided Story Snapshots")]
        public static void ValidateAll()
        {
            int ok = 0;
            foreach (var asset in LoadSnapshotAssets())
            {
                try
                {
                    var model = ShadowGuidedStoryLoader.Load(asset.text);
                    Debug.Log($"[GuidedStory] {model.StoryId}: {model.Entities.Count} entities, {model.Scenarios.Count} scenarios, {model.Steps.Count} steps — valid");
                    ok++;
                }
                catch (System.Exception e)
                {
                    Debug.LogError($"[GuidedStory] {asset.name}: INVALID — {e.Message}");
                }
            }
            Debug.Log($"[GuidedStory] validated {ok} snapshot(s).");
        }
    }
}
#endif
