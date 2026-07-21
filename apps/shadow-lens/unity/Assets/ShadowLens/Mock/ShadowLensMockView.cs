// apps/shadow-lens/unity/Assets/ShadowLens/Mock/ShadowLensMockView.cs
// The VISIBLE mock experience. Screen-space HUD (title + status + LAST ACTION + trust + decision
// + 6 operator buttons) and a world-space "frozen document" in front of the camera, plus a
// source-highlight overlay (bordered box + label + connector to the finding) and an audit arc
// placed INSIDE the camera frustum. Deterministic offline state machine off the sanitized
// fixture — no network, no XREAL SDK in editor/mock mode.
// STATUS: project compiles + enters Play Mode in Unity 6.0.0.23f1 (Alex). Analyze/Verify were
// confirmed rendering; this revision fixes Show Source (missing visual components) + Show Audit
// (camera/frustum placement). Newly authored — re-run in Unity to verify. No XREAL device
// validation claimed.
#if UNITY_2020_1_OR_NEWER
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace ShadowLens.Mock
{
    public enum MockState { Ready, Analyzing, Analyzed, SourceShown, AuditShown, Verified, Tampered }

    [DisallowMultipleComponent]
    public class ShadowLensMockView : MonoBehaviour
    {
        public MockState State { get; private set; } = MockState.Ready;
        public string LastAction { get; private set; } = "—";

        Text _status, _trust, _decision, _lastActionText, _finding;
        GameObject _srcGroup;                 // source-highlight overlay group (box+label+connector+finding)
        Transform _docWorld;
        Transform _auditCanvas;               // AuditArcRoot (world-space canvas, built in front of the camera)
        readonly List<GameObject> _auditNodes = new List<GameObject>();
        Font _font;
        bool _built;

        const int CitedRow = 1;               // Doc[1] = the cited "Debt-to-Income" row (source_id B0L1)
        static readonly string[] AuditStages = { "1 Capture", "2 OCR", "3 Source Map", "4 Analysis", "5 Review", "6 Signed Bundle", "7 Verify" };

        static readonly (string id, string line)[] Doc = {
            ("B0L0", "Annual income: $82,400"),
            ("B0L1", "Debt-to-income: 0.41"),   // the cited source (CitedRow = 1, source_id B0L1)
            ("B0L2", "Policy ceiling: 0.36"),
        };

        // ── test / diagnostics accessors ──
        public bool SourceOverlayActive => _srcGroup != null && _srcGroup.activeInHierarchy;
        public Transform SourceOverlayTransform => _srcGroup != null ? _srcGroup.transform : null;
        public bool AuditRootActive => _auditCanvas != null && _auditCanvas.gameObject.activeInHierarchy;
        public Transform AuditRootTransform => _auditCanvas;
        public int ActiveAuditNodeCount { get { int n = 0; foreach (var g in _auditNodes) if (g && g.activeInHierarchy) n++; return n; } }

        public ShadowInstitutionalLayoutController Layout;

        void Awake() { Build(); }

        public void Build()
        {
            if (_built) return;
            if (Layout == null) Layout = GetComponent<ShadowInstitutionalLayoutController>() ?? gameObject.AddComponent<ShadowInstitutionalLayoutController>();
            _font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            BuildHud();
            BuildDocument();
            _built = true;
            SetReady();
        }

        // ── chrome, built into the SHARED layout regions (no independent canvas → no overlap) ──
        void BuildHud()
        {
            var title = Layout.Region("title");
            MakeText(title, "TITLE", "SHADOW LENS", 26, new Vector2(0f, 1f), new Vector2(6, -6), new Color(0.85f, 0.95f, 1f), TextAnchor.UpperLeft);
            _status = MakeText(title, "STATUS", "READY", 15, new Vector2(0f, 0f), new Vector2(6, 6), ShadowLens.Design.ShadowDesignTokens.TextSecondary, TextAnchor.LowerLeft);

            _trust = MakeText(Layout.Region("trust"), "TRUST", "UNSIGNED", 18, new Vector2(1f, 0.5f), new Vector2(-12, 0), new Color(0.7f, 0.7f, 0.7f), TextAnchor.MiddleRight);
            _decision = null; // the FINDING now renders inside the document footer (set in BuildDocument)
            _lastActionText = null; // the spatial-agent panel owns the single LAST ACTION line (no duplicate)

            // §7 horizontal action rail (Analyze/Source/Audit/Verify) + separated presenter (Tamper/Reset)
            var rail = HGroup(Layout.Region("actionRail"));
            RailButton(rail, "Analyze", Analyze); RailButton(rail, "Show Source", ShowSource);
            RailButton(rail, "Show Audit", ShowAudit); RailButton(rail, "Verify", Verify);
            var pres = HGroup(Layout.Region("presenter"));
            RailButton(pres, "Tamper", Tamper); RailButton(pres, "Reset", ResetView);
        }

        Transform HGroup(RectTransform region)
        {
            var go = new GameObject("Rail", typeof(RectTransform), typeof(HorizontalLayoutGroup)); go.transform.SetParent(region, false);
            var rt = go.GetComponent<RectTransform>(); rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.offsetMin = Vector2.zero; rt.offsetMax = Vector2.zero;
            var h = go.GetComponent<HorizontalLayoutGroup>(); h.spacing = 6; h.childControlWidth = true; h.childForceExpandWidth = true; h.childControlHeight = true; h.childForceExpandHeight = true;
            return go.transform;
        }
        void RailButton(Transform parent, string label, System.Action onClick)
        {
            var go = new GameObject("Btn_" + label, typeof(Image), typeof(Button)); go.transform.SetParent(parent, false);
            go.GetComponent<Image>().color = ShadowLens.Design.ShadowDesignTokens.PanelSecondary;
            go.AddComponent<Outline>().effectColor = ShadowLens.Design.ShadowDesignTokens.Border;
            MakeText(go.transform, "Label", label, 15, new Vector2(0.5f, 0.5f), Vector2.zero, ShadowLens.Design.ShadowDesignTokens.TextPrimary, TextAnchor.MiddleCenter);
            var b = go.GetComponent<Button>(); b.onClick.RemoveAllListeners(); b.onClick.AddListener(() => onClick());
        }

        // ── world-space "frozen document" ~1.6 m in front of the camera ──
        void BuildDocument()
        {
            var cam = Camera.main;
            // Larger + slightly closer for headset readability, positioned toward the left of view.
            var pos = cam != null ? cam.transform.position + cam.transform.forward * 1.45f + cam.transform.right * -0.18f - cam.transform.up * 0.05f : new Vector3(-0.2f, 1.45f, -1.45f);
            var docGo = new GameObject("FrozenDocumentPlane", typeof(Canvas));
            docGo.transform.SetParent(transform, false);
            docGo.transform.position = pos;
            if (cam != null) docGo.transform.rotation = Quaternion.LookRotation(pos - cam.transform.position, cam.transform.up);
            docGo.GetComponent<Canvas>().renderMode = RenderMode.WorldSpace;
            var rt = docGo.GetComponent<RectTransform>();
            rt.sizeDelta = new Vector2(620, 820); rt.localScale = Vector3.one * 0.00165f; // ~1.0 m tall, readable
            _docWorld = docGo.transform;

            var bg = MakeImage(docGo.transform, "Paper", new Color(0.97f, 0.96f, 0.93f), Vector2.zero, new Vector2(620, 820), new Vector2(0.5f, 0.5f));
            MakeText(bg.transform, "DocTitle", "LOAN APPLICATION — FIXTURE", 34, new Vector2(0.5f, 1f), new Vector2(0, -40), new Color(0.2f, 0.1f, 0.1f), TextAnchor.UpperCenter);
            for (int i = 0; i < Doc.Length; i++)
                MakeText(bg.transform, "Line" + i, $"{Doc[i].id}   {Doc[i].line}", 32, new Vector2(0f, 1f), new Vector2(40, -120 - i * 64), new Color(0.12f, 0.12f, 0.12f), TextAnchor.UpperLeft);

            // the FINDING now lives in the document footer (replaces the old floating decision text)
            _finding = MakeText(bg.transform, "Finding", "", 26, new Vector2(0f, 0f), new Vector2(40, 40), new Color(0.55f, 0.15f, 0.1f), TextAnchor.LowerLeft);
            _finding.rectTransform.sizeDelta = new Vector2(540, 120);

            BuildSourceOverlay(bg.transform);
        }

        // Source overlay: bright bordered box over the cited row + label + connector + finding tag.
        void BuildSourceOverlay(Transform paper)
        {
            _srcGroup = new GameObject("SourceOverlay", typeof(RectTransform));
            var grt = _srcGroup.GetComponent<RectTransform>();
            grt.SetParent(paper, false);
            grt.anchorMin = Vector2.zero; grt.anchorMax = Vector2.one; grt.offsetMin = grt.offsetMax = Vector2.zero; // fill the paper
            float rowY = -120 - CitedRow * 60 + 6;

            // bordered box (bright yellow border via Outline; translucent cyan fill so text shows)
            var box = MakeImage(_srcGroup.transform, "Box", new Color(0.15f, 0.85f, 1f, 0.30f), new Vector2(34, rowY), new Vector2(470, 46), new Vector2(0f, 1f));
            var outline = box.gameObject.AddComponent<Outline>();
            outline.effectColor = new Color(1f, 0.9f, 0.1f, 1f); outline.effectDistance = new Vector2(3, 3);

            // label: source_id + cited quote
            MakeText(_srcGroup.transform, "SrcLabel", $"SOURCE {Doc[CitedRow].id}  ·  \"{Doc[CitedRow].line}\"", 22, new Vector2(0f, 1f), new Vector2(34, rowY - 54), new Color(0.05f, 0.35f, 0.5f), TextAnchor.UpperLeft);

            // connector (vertical bright line) from the box down to the finding tag
            MakeImage(_srcGroup.transform, "Connector", new Color(1f, 0.5f, 0.1f, 1f), new Vector2(50, rowY - 46), new Vector2(4, 70), new Vector2(0f, 1f));

            // finding tag (the claim this source backs)
            var tag = MakeImage(_srcGroup.transform, "FindingTag", new Color(0.55f, 0.15f, 0.1f, 0.9f), new Vector2(34, rowY - 120), new Vector2(500, 54), new Vector2(0f, 1f));
            MakeText(tag.transform, "FindingText", "▶ FINDING: DTI 0.41 exceeds the 0.36 ceiling", 22, new Vector2(0f, 0.5f), new Vector2(10, 0), Color.white, TextAnchor.MiddleLeft).rectTransform.sizeDelta = new Vector2(490, 54);

            _srcGroup.SetActive(false);
        }

        // ── state machine ──
        public void SetReady()
        {
            State = MockState.Ready;
            _status.text = "READY";
            _trust.text = "UNSIGNED"; _trust.color = new Color(0.7f, 0.7f, 0.7f);
            if (_finding) _finding.text = "";
            if (_srcGroup) _srcGroup.SetActive(false);
            if (_auditCanvas) _auditCanvas.gameObject.SetActive(false);
        }
        public void Analyze()
        {
            LogAction("ANALYZE");
            State = MockState.Analyzed;
            _status.text = "ANALYZED · 1 source-bound finding";
            if (_finding) _finding.text = "FINDING · DTI 0.41 exceeds the 0.36 policy ceiling (cites B0L1)";
        }
        public void ShowSource()
        {
            LogAction("SHOW_SOURCE");
            if (State == MockState.Ready) Analyze();
            State = MockState.SourceShown;
            if (_srcGroup) _srcGroup.SetActive(true);
            _status.text = "SOURCE\nfinding bound to B0L1";
            Debug.Log($"[ShadowLens] SHOW_SOURCE → overlay active={SourceOverlayActive} inFrustum={InFrustum(SourceOverlayTransform)}");
        }
        public void ShowAudit()
        {
            LogAction("SHOW_AUDIT");
            if (State == MockState.Ready) Analyze();
            State = MockState.AuditShown;
            BuildOrRefreshAuditArc();
            _status.text = "AUDIT\n7-stage evidence chain";
            Debug.Log($"[ShadowLens] SHOW_AUDIT → nodes={ActiveAuditNodeCount} rootActive={AuditRootActive} inFrustum={InFrustum(AuditRootTransform)}");
        }
        public void Verify()
        {
            LogAction("VERIFY");
            State = MockState.Verified;
            _trust.text = "SEALED · VERIFIED"; _trust.color = new Color(0.4f, 1f, 0.6f);
            _status.text = "VERIFIED\nrecord integrity intact";
        }
        public void Tamper()
        {
            LogAction("TAMPER");
            State = MockState.Tampered; // visual only — never mutates a real pristine bundle
            _trust.text = "TAMPERED · chain broken @ seq 3"; _trust.color = new Color(1f, 0.4f, 0.4f);
            _status.text = "TAMPERED\nverification fails";
            foreach (var n in _auditNodes) { var img = n ? n.GetComponent<Image>() : null; if (img) img.color = new Color(1f, 0.4f, 0.4f); }
        }
        public void ResetView() { LogAction("RESET"); SetReady(); }

        // Audit arc: a world-space canvas built directly in FRONT of the current camera (guaranteed
        // in frustum), with 7 labeled nodes on a shallow arc + connectors. Rebuilt each time so it
        // tracks the current head pose.
        void BuildOrRefreshAuditArc()
        {
            var cam = Camera.main;
            foreach (var n in _auditNodes) if (n) Destroy(n);
            _auditNodes.Clear();
            if (_auditCanvas != null) Destroy(_auditCanvas.gameObject);

            var go = new GameObject("AuditArcRoot", typeof(Canvas));
            go.transform.SetParent(transform, false);
            var center = cam != null ? cam.transform.position + cam.transform.forward * 2.2f + cam.transform.up * 0.15f : new Vector3(0, 1.6f, -2.2f);
            go.transform.position = center;
            if (cam != null) go.transform.rotation = Quaternion.LookRotation(center - cam.transform.position, cam.transform.up);
            go.GetComponent<Canvas>().renderMode = RenderMode.WorldSpace;
            var rt = go.GetComponent<RectTransform>();
            rt.sizeDelta = new Vector2(1100, 420); rt.localScale = Vector3.one * 0.0016f;
            _auditCanvas = go.transform;

            MakeText(go.transform, "AuditTitle", "AUDIT CHAIN", 30, new Vector2(0.5f, 1f), new Vector2(0, -10), new Color(0.4f, 1f, 0.6f), TextAnchor.UpperCenter);

            int count = AuditStages.Length;
            float span = 900f, x0 = -span / 2f, step = span / (count - 1);
            var xs = new float[count]; var ys = new float[count];
            for (int i = 0; i < count; i++)
            {
                xs[i] = x0 + step * i;
                ys[i] = -20f - Mathf.Abs(i - (count - 1) / 2f) * -14f; // shallow dome
            }
            // connectors first (behind nodes)
            for (int i = 0; i < count - 1; i++)
            {
                var mid = new Vector2((xs[i] + xs[i + 1]) / 2f, (ys[i] + ys[i + 1]) / 2f);
                var line = MakeImage(go.transform, "Link" + i, new Color(0.3f, 1f, 0.7f, 0.9f), mid, new Vector2(step, 5), new Vector2(0.5f, 0.5f));
                line.rectTransform.anchorMin = line.rectTransform.anchorMax = line.rectTransform.pivot = new Vector2(0.5f, 0.5f);
            }
            // nodes + labels
            for (int i = 0; i < count; i++)
            {
                var node = MakeImage(go.transform, "AuditNode" + i, new Color(0.2f, 1f, 0.6f, 1f), new Vector2(xs[i], ys[i]), new Vector2(72, 72), new Vector2(0.5f, 0.5f));
                node.rectTransform.anchorMin = node.rectTransform.anchorMax = node.rectTransform.pivot = new Vector2(0.5f, 0.5f);
                node.gameObject.AddComponent<Outline>().effectColor = Color.black;
                MakeText(node.transform, "Lbl", AuditStages[i], 18, new Vector2(0.5f, 0f), new Vector2(0, -8), Color.white, TextAnchor.UpperCenter).rectTransform.sizeDelta = new Vector2(150, 40);
                _auditNodes.Add(node.gameObject);
            }
            _auditCanvas.gameObject.SetActive(true);
        }

        // ── instrumentation ──
        void LogAction(string action)
        {
            LastAction = action;
            if (_lastActionText) _lastActionText.text = "LAST ACTION: " + action;
            Debug.Log($"[ShadowLens] button → {action} (state was {State})");
        }

        public void RunDiagnostics()
        {
            Debug.Log($"[ShadowLens] DIAG state={State} lastAction={LastAction}\n" +
                      $"  source overlay: active={SourceOverlayActive} inFrustum={InFrustum(SourceOverlayTransform)}\n" +
                      $"  audit: nodes={ActiveAuditNodeCount} rootActive={AuditRootActive} inFrustum={InFrustum(AuditRootTransform)}\n" +
                      $"  document inFrustum={InFrustum(_docWorld)}");
        }

        public bool InFrustum(Transform t)
        {
            if (t == null || Camera.main == null) return false;
            var planes = GeometryUtility.CalculateFrustumPlanes(Camera.main);
            var b = new Bounds(t.position, Vector3.one * 0.3f);
            return GeometryUtility.TestPlanesAABB(planes, b);
        }

        // ── tiny UI builders (legacy UI + builtin font, no TMP import needed) ──
        Text MakeText(Transform parent, string name, string text, int size, Vector2 anchor, Vector2 offset, Color color, TextAnchor align)
        {
            var go = new GameObject(name, typeof(Text));
            go.transform.SetParent(parent, false);
            var t = go.GetComponent<Text>();
            t.font = _font; t.text = text; t.fontSize = size; t.color = color; t.alignment = align;
            t.horizontalOverflow = HorizontalWrapMode.Overflow; t.verticalOverflow = VerticalWrapMode.Overflow;
            var rt = t.rectTransform; rt.anchorMin = rt.anchorMax = anchor; rt.pivot = anchor; rt.anchoredPosition = offset; rt.sizeDelta = new Vector2(560, 120);
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
        Button MakeButton(Transform parent, string label, Vector2 pos, System.Action onClick)
        {
            var go = new GameObject("Btn_" + label, typeof(Image), typeof(Button));
            go.transform.SetParent(parent, false);
            go.GetComponent<Image>().color = new Color(0.15f, 0.18f, 0.24f, 0.95f);
            var rt = go.GetComponent<RectTransform>(); rt.anchorMin = rt.anchorMax = rt.pivot = Vector2.zero; rt.anchoredPosition = pos; rt.sizeDelta = new Vector2(160, 42);
            MakeText(go.transform, "Label", label, 20, new Vector2(0.5f, 0.5f), Vector2.zero, Color.white, TextAnchor.MiddleCenter).rectTransform.sizeDelta = new Vector2(160, 42);
            var btn = go.GetComponent<Button>();
            btn.onClick.RemoveAllListeners();          // exactly one listener, even across a rebuild
            btn.onClick.AddListener(() => onClick());
            return btn;
        }
        static int ListenerCount(Button b) => b.onClick.GetPersistentEventCount();
    }
}
#endif
