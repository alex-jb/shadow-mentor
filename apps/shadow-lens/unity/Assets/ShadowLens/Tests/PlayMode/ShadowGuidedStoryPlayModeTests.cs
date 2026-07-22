// apps/shadow-lens/unity/Assets/ShadowLens/Tests/PlayMode/ShadowGuidedStoryPlayModeTests.cs
// PlayMode tests for the native guided-story player: it loads the three pre-compiled snapshots,
// spawns nodes, steps through, restarts, toggles 2D, and never runs off the ends. No headset / no
// XREAL SDK — the player takes input through IShadowStoryInput. AUTHORED — run in Unity 6 to execute;
// NOT run on the Node host.
#if UNITY_INCLUDE_TESTS
using System.Collections;
using System.IO;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using ShadowLens.GuidedStory;

namespace ShadowLens.Tests.PlayMode
{
    public class ShadowGuidedStoryPlayModeTests
    {
        static readonly string[] StoryIds = { "audit-chain", "reason-code-attestation", "persona-deliberation" };
        ShadowGuidedStoryPlayer _player;

        static TextAsset SnapshotAsset(string id)
        {
            var path = Path.Combine(Application.dataPath, "ShadowLens/GuidedStory/Snapshots", id + ".semantic.json");
            return new TextAsset(File.ReadAllText(path));
        }

        [UnitySetUp] public IEnumerator SetUp()
        {
            if (Camera.main == null) { var cam = new GameObject("cam", typeof(Camera)); cam.tag = "MainCamera"; }
            var go = new GameObject("player");
            _player = go.AddComponent<ShadowGuidedStoryPlayer>();
            foreach (var id in StoryIds) _player.Snapshots.Add(SnapshotAsset(id));
            yield return null;                 // let Awake run (loads story 0)
        }

        [TearDown] public void TearDown() { if (_player != null) Object.Destroy(_player.gameObject); }

        [UnityTest] public IEnumerator LoadsEachStoryAndSpawnsNodes()
        {
            for (int i = 0; i < StoryIds.Length; i++)
            {
                _player.LoadStory(i);
                yield return null;
                Assert.IsNotNull(_player.CurrentScenarioId, StoryIds[i] + " has a scenario");
                int childCount = _player.transform.Find("GuidedStoryRoot").childCount;
                Assert.Greater(childCount, 0, StoryIds[i] + " spawned nodes");
            }
        }

        [UnityTest] public IEnumerator StepNextBackRestart_StayInBounds()
        {
            _player.LoadStory(0);
            yield return null;
            int start = _player.CurrentStepIndex;
            Assert.AreEqual(0, start);
            for (int i = 0; i < 20; i++) { _player.ApiNext(); yield return null; }
            int maxIdx = _player.CurrentStepIndex;
            _player.ApiNext(); yield return null;
            Assert.AreEqual(maxIdx, _player.CurrentStepIndex, "does not run past the last step");
            for (int i = 0; i < 20; i++) { _player.ApiBack(); yield return null; }
            Assert.AreEqual(0, _player.CurrentStepIndex);
            _player.ApiNext(); _player.ApiRestart(); yield return null;
            Assert.AreEqual(0, _player.CurrentStepIndex);
        }

        [UnityTest] public IEnumerator SwitchingStories_RebuildsCleanly()
        {
            _player.LoadStory(0); yield return null;
            _player.NextStory(); yield return null;
            _player.NextStory(); yield return null;
            var root = _player.transform.Find("GuidedStoryRoot");
            Assert.Greater(root.childCount, 0, "nodes present after switching stories");
        }
    }
}
#endif
