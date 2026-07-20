// apps/shadow-lens/unity/Assets/ShadowLens/Bootstrap/ShadowLensRuntimeBootstrap.cs
// Constructs the COMPLETE mock application hierarchy at runtime, so opening a minimal empty
// scene and pressing Play runs the whole flow with no hand-authored .unity file:
//   fixture capture → fixture source_map → real HTTP /run → real source-bound analysis →
//   real sealed bundle → verify → source highlight → audit view → tamper → reset.
// The Editor scene generator (ShadowLensSceneGenerator) produces a saved scene from the same
// wiring when Unity is available. SOURCE AUTHORED · BUILD CONFIGURED · NOT COMPILED · DEVICE
// VALIDATION PENDING.
#if UNITY_2020_1_OR_NEWER
using UnityEngine;
using UnityEngine.EventSystems;
using ShadowLens.Core;
using ShadowLens.Spatial;
using ShadowLens.Providers;

namespace ShadowLens.Bootstrap
{
    public class ShadowLensRuntimeBootstrap : MonoBehaviour
    {
        public string apiBaseUrl = "https://shadow-mentor-phi.vercel.app";
        public bool autoRunOnStart = true;

        ShadowLensSceneController _controller;
        ProviderSet _providers;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        static void AutoBoot()
        {
            if (Object.FindObjectOfType<ShadowLensRuntimeBootstrap>() != null) return;
            var go = new GameObject("ShadowLensRuntimeBootstrap");
            go.AddComponent<ShadowLensRuntimeBootstrap>();
        }

        void Awake() => BuildHierarchy();

        public void BuildHierarchy()
        {
            EnsureEventSystem();
            EnsureCamera();

            _providers = ProviderBootstrap.Resolve(); // mock in Editor, XREAL/Android on device

            var documentPlane = MakePlane("FrozenDocumentPlane", new Vector3(0, 1.4f, -1.5f), new Vector3(0.6f, 0.8f, 1f));
            var viewerRig = new GameObject("ViewerRig").transform;

            var controllerGo = new GameObject("ShadowLensSessionController");
            _controller = controllerGo.AddComponent<ShadowLensSceneController>();
            _controller.documentPlane = documentPlane;
            _controller.viewerRig = viewerRig;
            _controller.sourceOverlayPrefab = MakeChipPrefab("SourceOverlay", new Color(0.2f, 0.8f, 1f, 0.5f));
            _controller.auditLinkPrefab = MakeChipPrefab("AuditLink", new Color(0.4f, 1f, 0.6f, 0.8f));
            _controller.riskBarPrefab = MakeChipPrefab("RiskBar", new Color(1f, 0.5f, 0.3f, 0.9f));
            _controller.glanceChipPrefab = MakeChipPrefab("GlanceChip", new Color(0.8f, 0.8f, 0.8f, 0.8f));
            _controller.Bind(_providers.Capture, _providers.Ocr, _providers.Tts);

            MakeRoot("DecisionPanel"); MakeRoot("AuditArcRoot"); MakeRoot("RiskLandscapeRoot");
            MakeRoot("ReviewerView"); MakeRoot("TrustHeader"); MakeRoot("DiagnosticsPanel");

            Debug.Log($"[ShadowLens] providers: {_providers.Status} (mock={_providers.IsMock})");

            if (autoRunOnStart) _controller.OnCommand(VoiceCommand.ScanDocument);
        }

        // ── convenience builders (primitives, so an empty scene runs) ──
        static void EnsureEventSystem()
        {
            if (Object.FindObjectOfType<EventSystem>() == null)
                new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
        }
        static void EnsureCamera()
        {
            if (Camera.main == null)
            {
                var cam = new GameObject("XR Origin (Mock Camera)", typeof(Camera));
                cam.tag = "MainCamera";
                cam.transform.position = new Vector3(0, 1.4f, 0);
            }
        }
        static Transform MakePlane(string name, Vector3 pos, Vector3 scale)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Quad);
            go.name = name; go.transform.position = pos; go.transform.localScale = scale;
            return go.transform;
        }
        static GameObject MakeChipPrefab(string name, Color c)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name + "Prefab"; go.transform.localScale = new Vector3(0.06f, 0.02f, 0.005f);
            var r = go.GetComponent<Renderer>(); if (r != null) r.material.color = c;
            go.SetActive(false); // template, cloned by the controller
            return go;
        }
        static Transform MakeRoot(string name) => new GameObject(name).transform;

        public ShadowLensSceneController Controller => _controller;
    }
}
#endif
