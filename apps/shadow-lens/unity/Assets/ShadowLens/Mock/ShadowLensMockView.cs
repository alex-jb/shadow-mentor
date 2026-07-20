// apps/shadow-lens/unity/Assets/ShadowLens/Mock/ShadowLensMockView.cs
// The VISIBLE mock experience (Game view renders real UI, not empty GameObjects). Builds a
// screen-space HUD (title + status + trust header + operator buttons) and a world-space
// "frozen document" in front of the camera, then drives a deterministic offline state machine
// off the sanitized fixture — no network, no XREAL SDK required in editor/mock mode.
// STATUS: the project compiled + entered Play Mode in Unity 6.0.0.23f1 (Alex, 2026-07-20);
// THIS mock-scene fix is newly authored and NOT YET RE-COMPILED/RUN by Alex — regenerate the
// scene + enter Play Mode to verify the visible render + PlayMode smoke tests. No XREAL device
// validation is claimed.
#if UNITY_2020_1_OR_NEWER
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using ShadowLens.Spatial;

namespace ShadowLens.Mock
{
    public enum MockState { Ready, Analyzing, Analyzed, SourceShown, AuditShown, Verified, Tampered }

    [DisallowMultipleComponent]
    public class ShadowLensMockView : MonoBehaviour
    {
        public MockState State { get; private set; } = MockState.Ready;

        Text _status, _trust, _decision;
        RectTransform _sourceHighlight;
        Transform _docWorld, _auditRoot;
        readonly List<GameObject> _auditNodes = new List<GameObject>();
        Font _font;
        bool _built;

        // sanitized fixture (matches apps/shadow-lens/fixtures/example-session.json intent)
        static readonly (string id, string line)[] Doc = {
            ("B0L0", "FICO Score: 706"),
            ("B0L1", "Debt-to-Income: 0.41"),
            ("B0L2", "Loan-to-Value: 0.83"),
            ("B0L3", "Annual Income: $92,400"),
        };

        void Awake() { Build(); }

        // Idempotent: safe to call repeatedly; never creates a second HUD/document.
        public void Build()
        {
            if (_built) return;
            _font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            BuildHud();
            BuildDocument();
            _auditRoot = new GameObject("AuditArcRoot").transform;
            _auditRoot.SetParent(transform, false);
            _built = true;
            SetReady();
        }

        // ── screen-space HUD (guaranteed visible) ──
        void BuildHud()
        {
            var canvasGo = new GameObject("ShadowLensHUD", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvasGo.GetComponent<CanvasScaler>().uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            canvasGo.GetComponent<CanvasScaler>().referenceResolution = new Vector2(1280, 720);

            MakeText(canvas.transform, "TITLE", "SHADOW LENS", 40, new Vector2(0.5f, 1f), new Vector2(0, -50), new Color(0.85f, 0.95f, 1f), TextAnchor.UpperCenter);
            _status = MakeText(canvas.transform, "STATUS", "FIXTURE MODE\nREADY TO ANALYZE", 26, new Vector2(0.5f, 1f), new Vector2(0, -110), Color.white, TextAnchor.UpperCenter);
            _trust = MakeText(canvas.transform, "TRUST", "UNSIGNED", 20, new Vector2(0f, 1f), new Vector2(20, -20), new Color(0.7f, 0.7f, 0.7f), TextAnchor.UpperLeft);
            _decision = MakeText(canvas.transform, "DECISION", "", 22, new Vector2(1f, 0.5f), new Vector2(-30, 0), new Color(1f, 0.85f, 0.6f), TextAnchor.UpperRight);

            string[] labels = { "Analyze", "Show Source", "Show Audit", "Verify", "Tamper", "Reset" };
            System.Action[] acts = { Analyze, ShowSource, ShowAudit, Verify, Tamper, ResetView };
            for (int i = 0; i < labels.Length; i++) MakeButton(canvas.transform, labels[i], new Vector2(20, 20 + i * 44), acts[i]);
        }

        // ── world-space "frozen document" ~1.6m in front of the camera ──
        void BuildDocument()
        {
            var cam = Camera.main;
            var pos = cam != null ? cam.transform.position + cam.transform.forward * 1.6f + Vector3.down * 0.1f : new Vector3(0, 1.4f, -1.6f);
            var docGo = new GameObject("FrozenDocumentPlane", typeof(Canvas));
            docGo.transform.SetParent(transform, false);
            docGo.transform.position = pos;
            if (cam != null) docGo.transform.rotation = Quaternion.LookRotation(docGo.transform.position - cam.transform.position);
            var canvas = docGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.WorldSpace;
            var rt = canvas.GetComponent<RectTransform>();
            rt.sizeDelta = new Vector2(600, 800);
            rt.localScale = Vector3.one * 0.0011f; // ~0.66m wide
            _docWorld = docGo.transform;

            var bg = MakeImage(docGo.transform, "Paper", new Color(0.97f, 0.96f, 0.93f), Vector2.zero, new Vector2(600, 800), new Vector2(0.5f, 0.5f));
            MakeText(bg.transform, "DocTitle", "LOAN FILE — FIXTURE", 34, new Vector2(0.5f, 1f), new Vector2(0, -40), new Color(0.2f, 0.1f, 0.1f), TextAnchor.UpperCenter);
            for (int i = 0; i < Doc.Length; i++)
                MakeText(bg.transform, "Line" + i, Doc[i].line, 30, new Vector2(0f, 1f), new Vector2(40, -120 - i * 60), new Color(0.12f, 0.12f, 0.12f), TextAnchor.UpperLeft);

            // source highlight overlay (hidden until Show Source)
            var hl = MakeImage(bg.transform, "SourceHighlight", new Color(0.2f, 0.7f, 1f, 0.35f), new Vector2(40, -120 - 1 * 60 - 10), new Vector2(420, 44), new Vector2(0f, 1f));
            _sourceHighlight = hl.GetComponent<RectTransform>();
            _sourceHighlight.gameObject.SetActive(false);
        }

        // ── deterministic offline state machine (visible changes) ──
        public void SetReady()
        {
            State = MockState.Ready;
            _status.text = "FIXTURE MODE\nREADY TO ANALYZE";
            _trust.text = "UNSIGNED"; _trust.color = new Color(0.7f, 0.7f, 0.7f);
            _decision.text = "";
            if (_sourceHighlight) _sourceHighlight.gameObject.SetActive(false);
            ClearAudit();
        }
        public void Analyze()
        {
            State = MockState.Analyzed;
            _status.text = "ANALYZED\n1 source-bound finding";
            _decision.text = "FINDING\nDTI 0.41 exceeds the\n0.36 policy ceiling\n(cites B0L1)";
        }
        public void ShowSource()
        {
            if (State == MockState.Ready) Analyze();
            State = MockState.SourceShown;
            if (_sourceHighlight) _sourceHighlight.gameObject.SetActive(true); // highlights the DTI line
            _status.text = "SOURCE\nfinding bound to B0L1";
        }
        public void ShowAudit()
        {
            if (State == MockState.Ready) Analyze();
            State = MockState.AuditShown;
            ClearAudit();
            var pts = SpatialLayout.AuditArc(5, 1.2f, 120f);
            var cam = Camera.main; var origin = cam != null ? cam.transform.position : Vector3.zero;
            foreach (var p in pts)
            {
                var n = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                n.name = "AuditNode"; n.transform.SetParent(_auditRoot, false);
                n.transform.position = origin + new Vector3(p.x, p.y + 1.2f, p.z);
                n.transform.localScale = Vector3.one * 0.08f;
                var r = n.GetComponent<Renderer>(); if (r) r.material.color = new Color(0.4f, 1f, 0.6f);
                _auditNodes.Add(n);
            }
            _status.text = "AUDIT\n5-event hash chain";
        }
        public void Verify()
        {
            State = MockState.Verified;
            _trust.text = "SEALED · VERIFIED"; _trust.color = new Color(0.4f, 1f, 0.6f);
            _status.text = "VERIFIED\nrecord integrity intact";
        }
        public void Tamper()
        {
            State = MockState.Tampered; // visual only — never mutates a real pristine bundle
            _trust.text = "TAMPERED · chain broken @ seq 3"; _trust.color = new Color(1f, 0.4f, 0.4f);
            _status.text = "TAMPERED\nverification fails";
            foreach (var n in _auditNodes) { var r = n.GetComponent<Renderer>(); if (r) r.material.color = new Color(1f, 0.4f, 0.4f); }
        }
        public void ResetView() => SetReady();

        void ClearAudit() { foreach (var n in _auditNodes) if (n) Destroy(n); _auditNodes.Clear(); }

        // ── tiny UI builders (legacy UI + builtin font, no TMP import needed) ──
        Text MakeText(Transform parent, string name, string text, int size, Vector2 anchor, Vector2 offset, Color color, TextAnchor align)
        {
            var go = new GameObject(name, typeof(Text));
            go.transform.SetParent(parent, false);
            var t = go.GetComponent<Text>();
            t.font = _font; t.text = text; t.fontSize = size; t.color = color; t.alignment = align; t.horizontalOverflow = HorizontalWrapMode.Overflow; t.verticalOverflow = VerticalWrapMode.Overflow;
            var rt = t.rectTransform; rt.anchorMin = rt.anchorMax = anchor; rt.pivot = anchor; rt.anchoredPosition = offset; rt.sizeDelta = new Vector2(560, 200);
            return t;
        }
        Image MakeImage(Transform parent, string name, Color color, Vector2 pos, Vector2 size, Vector2 anchor)
        {
            var go = new GameObject(name, typeof(Image));
            go.transform.SetParent(parent, false);
            var img = go.GetComponent<Image>(); img.color = color;
            var rt = img.rectTransform; rt.anchorMin = rt.anchorMax = anchor; rt.pivot = anchor; rt.anchoredPosition = pos; rt.sizeDelta = size;
            return img;
        }
        void MakeButton(Transform parent, string label, Vector2 pos, System.Action onClick)
        {
            var go = new GameObject("Btn_" + label, typeof(Image), typeof(Button));
            go.transform.SetParent(parent, false);
            go.GetComponent<Image>().color = new Color(0.15f, 0.18f, 0.24f, 0.95f);
            var rt = go.GetComponent<RectTransform>(); rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0, 0); rt.anchoredPosition = pos; rt.sizeDelta = new Vector2(150, 40);
            var txt = MakeText(go.transform, "Label", label, 20, new Vector2(0.5f, 0.5f), Vector2.zero, Color.white, TextAnchor.MiddleCenter);
            txt.rectTransform.sizeDelta = new Vector2(150, 40);
            go.GetComponent<Button>().onClick.AddListener(() => onClick());
        }
    }
}
#endif
