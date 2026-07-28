// apps/shadow-lens/unity/Assets/ShadowLens/Mock/ShadowInstitutionalLayoutController.cs
// The SINGLE layout authority: owns ONE screen-space canvas and defines anchored, responsive
// regions so the document view + spatial-agent panel stop positioning independently (the source of
// the overlap). Regions are anchored in viewport fractions, so they scale across 16:9 / 4:3 /
// narrow editor Game views with no hardcoded per-component coordinates. Also provides runtime
// overlap/frustum/size validation (§10). SOURCE AUTHORED · compiled in Unity 6 (Gate 2 layout pass).
#if UNITY_2020_1_OR_NEWER
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace ShadowLens.Mock
{
    [DisallowMultipleComponent]
    public class ShadowInstitutionalLayoutController : MonoBehaviour
    {
        public Canvas Canvas { get; private set; }
        readonly Dictionary<string, RectTransform> _regions = new Dictionary<string, RectTransform>();

        // region name -> (anchorMin, anchorMax) in viewport fractions (0,0 bottom-left .. 1,1 top-right)
        static readonly Dictionary<string, (Vector2 min, Vector2 max)> Layout = new Dictionary<string, (Vector2, Vector2)> {
            { "title",      (new Vector2(0.015f, 0.90f), new Vector2(0.26f, 0.99f)) },  // top-left identity
            { "trust",      (new Vector2(0.28f, 0.905f), new Vector2(0.985f, 0.99f)) }, // top band, compact
            { "profile",    (new Vector2(0.34f, 0.83f), new Vector2(0.66f, 0.895f)) },  // segmented control below trust
            { "document",   (new Vector2(0.02f, 0.19f), new Vector2(0.44f, 0.80f)) },   // ~42% width, large (world doc anchors here)
            { "answer",     (new Vector2(0.60f, 0.30f), new Vector2(0.985f, 0.80f)) },  // center-right
            { "status",     (new Vector2(0.015f, 0.015f), new Vector2(0.30f, 0.105f)) },// ONE compact status row
            { "query",      (new Vector2(0.315f, 0.115f), new Vector2(0.685f, 0.175f)) },// bottom-center, under workspace
            { "actionRail", (new Vector2(0.315f, 0.03f), new Vector2(0.685f, 0.105f)) }, // bottom horizontal rail
            { "presenter",  (new Vector2(0.82f, 0.02f), new Vector2(0.985f, 0.11f)) },   // bottom-right, separated
        };

        Vector2 _lastSize;

        void Awake() { EnsureCanvas(); }
        void Update() { var s = CurrentSize(); if (s != _lastSize) { _lastSize = s; /* anchors auto-resize; hook for future headset mode */ } }

        void EnsureCanvas()
        {
            if (Canvas != null) return;
            var go = new GameObject("ShadowInstitutionalCanvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            go.transform.SetParent(transform, false);
            Canvas = go.GetComponent<Canvas>();
            Canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = go.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1600, 900);
            scaler.matchWidthOrHeight = 0.5f; // balance width/height so 16:9 + 4:3 both stay sane
        }

        // Returns (creating if needed) the anchored region container to parent content into.
        public RectTransform Region(string name)
        {
            EnsureCanvas();
            if (_regions.TryGetValue(name, out var rt) && rt) return rt;
            var go = new GameObject("Region_" + name, typeof(RectTransform));
            go.transform.SetParent(Canvas.transform, false);
            var r = go.GetComponent<RectTransform>();
            var a = Layout.TryGetValue(name, out var lay) ? lay : (Vector2.zero, Vector2.one);
            r.anchorMin = a.Item1; r.anchorMax = a.Item2; r.offsetMin = Vector2.zero; r.offsetMax = Vector2.zero;
            _regions[name] = r;
            return r;
        }

        // ── §10 runtime validation ──
        public static Rect ScreenRect(RectTransform rt)
        {
            var c = new Vector3[4]; rt.GetWorldCorners(c); // overlay canvas world corners == screen px
            return new Rect(c[0].x, c[0].y, c[2].x - c[0].x, c[2].y - c[0].y);
        }
        public bool Overlaps(string a, string b) => ScreenRect(Region(a)).Overlaps(ScreenRect(Region(b)));
        public bool RegionInsideScreen(string name)
        {
            var r = ScreenRect(Region(name));
            return r.xMin >= -1 && r.yMin >= -1 && r.xMax <= Screen.width + 1 && r.yMax <= Screen.height + 1;
        }
        static Vector2 CurrentSize() => new Vector2(Screen.width, Screen.height);

        // Report all pairwise overlaps of the primary content regions (title/document/answer/query/profile).
        public List<string> DetectOverlaps()
        {
            var names = new[] { "title", "trust", "profile", "document", "answer", "query", "actionRail", "presenter", "status" };
            var hits = new List<string>();
            for (int i = 0; i < names.Length; i++)
                for (int j = i + 1; j < names.Length; j++)
                    if (Overlaps(names[i], names[j])) hits.Add(names[i] + " × " + names[j]);
            return hits;
        }
    }
}
#endif
