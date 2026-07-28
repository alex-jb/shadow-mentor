// apps/shadow-lens/unity/Assets/ShadowLens/Spatial/ShadowHeadDirectedFocus.cs
// HEAD-DIRECTED FOCUS — NOT eye tracking. A ray from the camera's forward direction (the
// 3DoF head orientation on XREAL One Pro; no Eye add-on, no eye tracking) hovers and
// highlights whatever it points at. This is XRI-compatible: swapping the ray origin for a
// Unity XR Gaze Interactor changes nothing about this contract.
//
// HARD CONTRACT: hover + highlight ONLY. It never approves, submits a decision, or triggers
// any high-risk action. There is no dwell-to-confirm. Pointer/touch (Beam Pro controller)
// remain the sole action path. TriggersApproval is a compile-time false a test can assert.
#if UNITY_2020_1_OR_NEWER
using UnityEngine;

namespace ShadowLens.Spatial
{
    [DisallowMultipleComponent]
    public class ShadowHeadDirectedFocus : MonoBehaviour
    {
        public const bool TriggersApproval = false;   // this input path NEVER approves anything
        public const string ModeLabel = "HEAD-DIRECTED FOCUS";  // never "EYE TRACKING" / "looking at"

        public float maxDistance = 6f;
        public Color highlight = Color.white;

        Transform _cam;
        GameObject _hovered;
        Color _hoveredOriginal;
        bool _hasOriginal;

        public GameObject Hovered => _hovered;
        public string FocusLabel { get; private set; } = "";

        void Awake() { _cam = Camera.main ? Camera.main.transform : null; }

        void Update()
        {
            if (_cam == null) { _cam = Camera.main ? Camera.main.transform : null; if (_cam == null) return; }
            Restore();
            if (Physics.Raycast(_cam.position, _cam.forward, out var hit, maxDistance))
            {
                var go = hit.collider ? hit.collider.gameObject : null;
                if (go != null && go.name.StartsWith("Voice_")) { Apply(go); FocusLabel = ModeLabel + ": " + go.name.Substring(6); return; }
            }
            FocusLabel = "";
        }

        void Apply(GameObject go)
        {
            var r = go.GetComponent<Renderer>();
            if (r == null) return;
            _hovered = go; _hoveredOriginal = r.material.color; _hasOriginal = true;
            r.material.color = highlight;
        }

        void Restore()
        {
            if (_hasOriginal && _hovered) { var r = _hovered.GetComponent<Renderer>(); if (r) r.material.color = _hoveredOriginal; }
            _hovered = null; _hasOriginal = false;
        }

        // Even an explicit "select" is highlight-only here — deliberately does NOT approve,
        // submit, mutate narrative state, or trigger any decision. High-risk actions require
        // the pointer/controller path, never focus.
        public void SelectHovered() { /* no-op by contract: focus never approves */ }
    }
}
#endif
