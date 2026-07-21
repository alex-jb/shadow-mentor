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

        public ShadowSpatialAgentPanel SpatialPanel { get; private set; }
        public ShadowInstitutionalLayoutController LayoutController { get; private set; }

        // Idempotent: reuses existing critical objects instead of appending new ones.
        public void BuildHierarchy()
        {
            EnsureEventSystem();
            EnsureCamera();
            var root = EnsureRoot();
            // ONE shared layout authority, created BEFORE the view/panel so both build into its
            // regions (no independent canvases → no overlap). MockView.Build finds it via GetComponent.
            LayoutController = root.GetComponent<ShadowInstitutionalLayoutController>();
            if (LayoutController == null) LayoutController = root.gameObject.AddComponent<ShadowInstitutionalLayoutController>();

            View = root.GetComponent<ShadowLensMockView>();
            if (View == null) View = root.gameObject.AddComponent<ShadowLensMockView>();
            View.Layout = LayoutController;
            View.Build();
            EnsureSpatialPanel(root);            // Gate 2 — additive; does NOT touch the existing view/buttons
            if (autoRunOnStart) View.Analyze();
        }

        // Gate 2 spatial-agent panel — exactly one, bound to the existing MockView. Idempotent.
        void EnsureSpatialPanel(Transform root)
        {
            SpatialPanel = root.GetComponent<ShadowSpatialAgentPanel>();
            if (SpatialPanel == null) SpatialPanel = root.gameObject.AddComponent<ShadowSpatialAgentPanel>();
            SpatialPanel.View = View;
            SpatialPanel.Layout = LayoutController;   // shared layout authority (no independent canvas)
            SpatialPanel.Build();
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
            Camera cam = Camera.main;
            if (cam == null)
            {
                var go = new GameObject("XR Origin (Mock Camera)", typeof(Camera), typeof(AudioListener));
                go.tag = "MainCamera";
                go.transform.position = new Vector3(0, 1.5f, 0); // standing height
                cam = go.GetComponent<Camera>();
            }
            // Institutional dark neutral environment — no default skybox/brown horizon (desktop mock).
            // In passthrough/XR the panels carry their own opacity/border, so this is harmless there.
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = ShadowLens.Design.ShadowDesignTokens.Background;
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
