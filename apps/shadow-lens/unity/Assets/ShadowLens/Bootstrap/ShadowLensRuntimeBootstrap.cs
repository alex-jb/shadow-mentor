// apps/shadow-lens/unity/Assets/ShadowLens/Bootstrap/ShadowLensRuntimeBootstrap.cs
// IDEMPOTENT bootstrap: guarantees EXACTLY ONE of each critical object (bootstrap, EventSystem,
// main camera, mock-demo root) across scene load AND Play Mode entry, then delegates the
// VISIBLE experience to ShadowLensMockView. A generated scene may already contain a bootstrap;
// the auto-boot never adds a second, and a duplicate instance destroys itself.
// STATUS: the project compiled + entered Play Mode in Unity 6 (Alex, 2026-07-20); THIS
// idempotency rewrite is newly authored and NOT YET RE-COMPILED/RUN by Alex.
#if UNITY_2020_1_OR_NEWER
using UnityEngine;
using UnityEngine.EventSystems;
using ShadowLens.Mock;

namespace ShadowLens.Bootstrap
{
    [DisallowMultipleComponent]
    public class ShadowLensRuntimeBootstrap : MonoBehaviour
    {
        public const string RootName = "ShadowLensMockDemoRoot";
        public bool autoRunOnStart = false; // Ready state waits for the operator's Analyze

        static ShadowLensRuntimeBootstrap _instance;
        public ShadowLensMockView View { get; private set; }

        // Auto-create a bootstrap ONLY if the loaded scene has none (so a generated scene that
        // already contains one is not duplicated).
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void AutoBoot()
        {
            if (FindFirstObjectByType<ShadowLensRuntimeBootstrap>() != null) return;
            new GameObject(nameof(ShadowLensRuntimeBootstrap)).AddComponent<ShadowLensRuntimeBootstrap>();
        }

        void Awake()
        {
            // Singleton guard — destroy the newer duplicate, keep the first.
            if (_instance != null && _instance != this) { Destroy(gameObject); return; }
            _instance = this;
            BuildHierarchy();
        }

        void OnDestroy() { if (_instance == this) _instance = null; }

        // Idempotent: reuses existing critical objects instead of appending new ones.
        public void BuildHierarchy()
        {
            EnsureEventSystem();
            EnsureCamera();
            var root = EnsureRoot();
            View = root.GetComponent<ShadowLensMockView>();
            if (View == null) View = root.gameObject.AddComponent<ShadowLensMockView>();
            View.Build();
            if (autoRunOnStart) View.Analyze();
        }

        static void EnsureEventSystem()
        {
            var systems = FindObjectsByType<EventSystem>(FindObjectsSortMode.None);
            if (systems.Length == 0)
                new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
            else
                for (int i = 1; i < systems.Length; i++) Destroy(systems[i].gameObject); // collapse duplicates
        }

        static void EnsureCamera()
        {
            if (Camera.main != null) return;
            var cam = new GameObject("XR Origin (Mock Camera)", typeof(Camera), typeof(AudioListener));
            cam.tag = "MainCamera";
            cam.transform.position = new Vector3(0, 1.5f, 0); // standing height
        }

        static Transform EnsureRoot()
        {
            var existing = GameObject.Find(RootName);
            if (existing != null) return existing.transform;
            return new GameObject(RootName).transform;
        }
    }
}
#endif
