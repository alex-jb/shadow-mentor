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
using ShadowLens.Narrative;

namespace ShadowLens.Bootstrap
{
    [DisallowMultipleComponent]
    public class ShadowLensRuntimeBootstrap : MonoBehaviour
    {
        public const string RootName = "ShadowLensMockDemoRoot";
        public bool autoRunOnStart = false; // Ready state waits for the operator's Analyze
        public bool useGuidedStage = true;  // Wednesday: boot straight into the guided Banking READY stage

        public ShadowStageController Stage { get; private set; }
        public bool GuidedStageActive { get; private set; }

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

        // Idempotent: reuses existing critical objects instead of appending new ones. Boots into the
        // guided stage when it initializes; otherwise falls back to the legacy MockView/panel. Never
        // creates a second stage / HUD / StageWorld / EventSystem, and never destroys working legacy
        // objects merely because the guided stage exists.
        public void BuildHierarchy()
        {
            EnsureEventSystem();
            EnsureCamera();
            var root = EnsureRoot();

            if (useGuidedStage && TryEnsureGuidedStage(root))
            {
                GuidedStageActive = true;   // guided Banking READY — deterministic, offline
                return;                     // do NOT also build the legacy UI (avoids overlap)
            }

            // ── legacy fallback: the existing MockView + spatial-agent panel ──
            GuidedStageActive = false;
            LayoutController = root.GetComponent<ShadowInstitutionalLayoutController>();
            if (LayoutController == null) LayoutController = root.gameObject.AddComponent<ShadowInstitutionalLayoutController>();
            View = root.GetComponent<ShadowLensMockView>();
            if (View == null) View = root.gameObject.AddComponent<ShadowLensMockView>();
            View.Layout = LayoutController;
            View.Build();
            EnsureSpatialPanel(root);
            if (autoRunOnStart) View.Analyze();
        }

        // Exactly one guided stage on the demo root. Idempotent (reuses an existing one). On any init
        // failure, logs ONE material error + returns false so the legacy path runs (no per-frame spam).
        bool TryEnsureGuidedStage(Transform root)
        {
            try
            {
                Stage = root.GetComponent<ShadowStageController>();
                if (Stage == null) Stage = root.gameObject.AddComponent<ShadowStageController>();
                Stage.Build();                              // idempotent; initializes to Banking READY
                return Stage.State == ShadowNarrativeState.READY;
            }
            catch (System.Exception e)
            {
                Debug.LogError("[bootstrap] guided stage init failed — falling back to legacy: " + e.Message);
                if (Stage != null) { Destroy(Stage); Stage = null; }
                return false;
            }
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
