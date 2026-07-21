// apps/shadow-lens/unity/Assets/ShadowLens/Mock/ShadowSpatialAgentPanel.cs
// Gate 2 (layout pass) — the spatial-agent surface, now built into the SHARED
// ShadowInstitutionalLayoutController regions (no independent canvas → no overlap). Segmented
// profile control with user-facing labels, a readable Grounded Answer Card, a profile-aware Query
// Bar, and ONE compact status row (state · LAST ACTION · MODEL · SESSION). Wires the tested
// protocol with a deterministic offline transport + the bridge to the existing MockView. No live
// LLM. Product logic unchanged. SOURCE AUTHORED · compiled in Unity 6.
#if UNITY_2020_1_OR_NEWER
using UnityEngine;
using UnityEngine.UI;
using ShadowLens.SpatialAgent;
using ShadowLens.Design;

namespace ShadowLens.Mock
{
    [DisallowMultipleComponent]
    public class ShadowSpatialAgentPanel : MonoBehaviour, IShadowActionStatusView
    {
        public ShadowLensMockView View;
        public ShadowInstitutionalLayoutController Layout;
        public string Profile = "banking-v1";

        Font _font;
        Text _answer, _grounded, _profileLbl, _actionStatus, _lastAction, _focus, _state, _model, _session, _placeholder;
        InputField _input;
        Button _askButton;
        int _lastSubmitFrame = -1;
        Transform _citations;
        readonly System.Collections.Generic.Dictionary<string, Image> _segButtons = new System.Collections.Generic.Dictionary<string, Image>();
        ShadowSpatialQueryController _controller;
        ShadowSpatialSceneIndex _scene;
        bool _built;

        static readonly (string id, string label)[] PROFILES = {
            ("banking-v1", "BANKING"), ("data-science-v1", "DATA SCIENCE"), ("coding-agent-v1", "CODING AGENT") };

        // test accessors
        public string AnswerText => _answer ? _answer.text : "";
        public string LastActionText => _lastAction ? _lastAction.text : "";
        public string FocusText => _focus ? _focus.text : "";
        public string GroundedText => _grounded ? _grounded.text : "";
        public string StateText => _state ? _state.text : "";
        public int CitationCount => _citations ? _citations.childCount : 0;
        public RectTransform AnswerRegion => Layout ? Layout.Region("answer") : null;
        public RectTransform ProfileRegion => Layout ? Layout.Region("profile") : null;

        // No auto-build in Awake — the bootstrap sets View + Layout first, then calls Build(), so
        // the controller is wired with a valid renderer (avoids a null-view bridge init race).
        public void Build()
        {
            if (_built) return;
            if (Layout == null) Layout = GetComponent<ShadowInstitutionalLayoutController>() ?? gameObject.AddComponent<ShadowInstitutionalLayoutController>();
            _font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            BuildProfileSelector();
            BuildAnswerCard();
            BuildQueryBar();
            BuildStatusRow();
            Rewire();
            _built = true;
            UpdatePlaceholder();
        }

        // ── §3 segmented profile control (user-facing labels; obvious selected state) ──
        void BuildProfileSelector()
        {
            var region = Layout.Region("profile");
            var bg = FillPanel(region, "SegBg", ShadowDesignTokens.PanelSecondary);
            var row = new GameObject("Seg", typeof(RectTransform), typeof(HorizontalLayoutGroup)).GetComponent<RectTransform>();
            row.SetParent(bg.transform, false); Fill(row);
            var hl = row.GetComponent<HorizontalLayoutGroup>(); hl.childControlWidth = true; hl.childForceExpandWidth = true; hl.spacing = 2; hl.padding = new RectOffset(3, 3, 3, 3);
            foreach (var (id, label) in PROFILES)
            {
                var pid = id;
                var seg = new GameObject("Seg_" + label, typeof(Image), typeof(Button)); seg.transform.SetParent(row, false);
                var img = seg.GetComponent<Image>(); img.color = ShadowDesignTokens.PanelPrimary;
                _segButtons[id] = img;
                Centered(seg.transform, label, 15, ShadowDesignTokens.TextPrimary);
                seg.GetComponent<Button>().onClick.AddListener(() => SetProfile(pid));
            }
        }

        // ── §5 grounded answer card (readable, ordered, bounded) ──
        void BuildAnswerCard()
        {
            var region = Layout.Region("answer");
            var card = FillPanel(region, "AnswerCard", ShadowDesignTokens.PanelPrimary);
            var col = VLayout(card.transform, 8, new RectOffset(16, 16, 14, 14));
            var header = Row(col, 22);
            _profileLbl = Left(header, "BANKING", 13, ShadowDesignTokens.TextSecondary);
            _grounded = Right(header, "", 13, ShadowDesignTokens.Neutral);
            Label(col, "GROUNDED ANSWER", 13, ShadowDesignTokens.Information, TextAnchor.UpperLeft, 18);
            _answer = Label(col, "Ask a grounded question about this evidence.", 20, ShadowDesignTokens.TextPrimary, TextAnchor.UpperLeft, 140);
            var citeHost = new GameObject("Citations", typeof(RectTransform), typeof(HorizontalLayoutGroup), typeof(LayoutElement)); citeHost.transform.SetParent(col, false);
            var chl = citeHost.GetComponent<HorizontalLayoutGroup>(); chl.spacing = 6; chl.childForceExpandWidth = false;
            citeHost.GetComponent<LayoutElement>().minHeight = 28;
            _citations = citeHost.transform;
            _focus = Label(col, "", 14, ShadowDesignTokens.Information, TextAnchor.UpperLeft, 22);
            _actionStatus = Label(col, "", 14, ShadowDesignTokens.TextSecondary, TextAnchor.UpperLeft, 22);
        }

        // ── §8 query bar (profile-aware placeholder, Ask, keyboard submit) ──
        void BuildQueryBar()
        {
            var region = Layout.Region("query");
            var bar = FillPanel(region, "QueryBar", ShadowDesignTokens.PanelPrimary);
            var inputGo = new GameObject("Input", typeof(Image), typeof(InputField)); inputGo.transform.SetParent(bar.transform, false);
            var irt = inputGo.GetComponent<RectTransform>(); irt.anchorMin = new Vector2(0, 0); irt.anchorMax = new Vector2(1, 1); irt.offsetMin = new Vector2(10, 8); irt.offsetMax = new Vector2(-104, -8);
            inputGo.GetComponent<Image>().color = ShadowDesignTokens.Background;
            _placeholder = Label(inputGo.transform, "Ask…", 16, ShadowDesignTokens.TextSecondary, TextAnchor.MiddleLeft, 0); Fill((RectTransform)_placeholder.transform); _placeholder.rectTransform.offsetMin = new Vector2(10, 0); _placeholder.rectTransform.offsetMax = new Vector2(-6, 0);
            var textComp = Label(inputGo.transform, "", 16, ShadowDesignTokens.TextPrimary, TextAnchor.MiddleLeft, 0); Fill((RectTransform)textComp.transform); textComp.rectTransform.offsetMin = new Vector2(10, 0); textComp.rectTransform.offsetMax = new Vector2(-6, 0);
            _input = inputGo.GetComponent<InputField>(); _input.textComponent = textComp; _input.placeholder = _placeholder;
            _input.onSubmit.RemoveAllListeners();          // exactly one listener
            _input.onSubmit.AddListener(RunQuery);
            var askGo = new GameObject("Ask", typeof(Image), typeof(Button)); askGo.transform.SetParent(bar.transform, false);
            var art = askGo.GetComponent<RectTransform>(); art.anchorMin = new Vector2(1, 0); art.anchorMax = new Vector2(1, 1); art.pivot = new Vector2(1, 0.5f); art.anchoredPosition = new Vector2(-8, 0); art.sizeDelta = new Vector2(88, 0); art.offsetMin = new Vector2(art.offsetMin.x, 8); art.offsetMax = new Vector2(art.offsetMax.x, -8);
            askGo.GetComponent<Image>().color = ShadowDesignTokens.Information;
            Centered(askGo.transform, "Ask", 16, ShadowDesignTokens.Background);
            _askButton = askGo.GetComponent<Button>();
            _askButton.onClick.RemoveAllListeners();       // exactly one listener
            _askButton.onClick.AddListener(() => RunQuery(_input.text));
        }

        // ── §6 one compact status row ──
        void BuildStatusRow()
        {
            var region = Layout.Region("status");
            var panel = FillPanel(region, "StatusRow", ShadowDesignTokens.PanelSecondary);
            var col = VLayout(panel.transform, 2, new RectOffset(10, 10, 6, 6));
            _state = Label(col, "READY", 14, ShadowDesignTokens.Neutral, TextAnchor.UpperLeft, 18);
            _lastAction = Label(col, "LAST ACTION: —", 13, ShadowDesignTokens.TextSecondary, TextAnchor.UpperLeft, 16);
            _model = Label(col, "MODEL: FIXTURE", 12, ShadowDesignTokens.TextSecondary, TextAnchor.UpperLeft, 14);
            _session = Label(col, "SESSION: REAL SIGNED", 12, ShadowDesignTokens.TextSecondary, TextAnchor.UpperLeft, 14);
        }

        void Rewire()
        {
            var cfg = new ShadowSpatialAgentConfig { Profile = Profile, UseFixtureTransport = true };
            var transport = new ShadowSpatialAgentMockTransport { Responder = ShadowSpatialDemoFixtures.ResponderFor(Profile) };
            var client = new ShadowSpatialAgentClient(cfg, transport);
            var bridge = new ShadowLensRendererBridge(View, SetFocus);
            _controller = new ShadowSpatialQueryController(client, bridge, new ShadowSpatialAgentStateMachine(), this, new ShadowActionExecutionReporter { Platform = "unity" });
            _controller.OnBeginQuery = ClearTransient;               // clear prev answer/citations/LAST ACTION before QUERYING
            _controller.OnControlsEnabled = SetControlsEnabled;      // disable while querying, re-enable after
            _controller.Log = (m) => Debug.Log("[spatial-agent] " + m);
            _scene = new ShadowSpatialSceneIndex(ShadowSpatialDemoFixtures.SceneFor(Profile));
            if (_profileLbl) _profileLbl.text = DisplayName(Profile);
            HighlightSelected();
        }

        // §3 full profile-context reset: cancel any in-flight query, clear stale UI, default mode, READY.
        // Preserves the underlying signed session/verification (a fresh fixture session is loaded per profile).
        public void SetProfile(string profile)
        {
            if (_controller != null) _controller.Cancel();
            Profile = profile;
            Rewire();                     // new scene index + responder + display label + selected highlight
            ClearTransient();             // clear answer, citations, LAST ACTION, focus
            if (View) { View.SetWorkspace(profile); View.SetReady(); } // rebuild the profile's artifact + default mode
            SetState("READY");
            UpdatePlaceholder();
            Debug.Log("[spatial-agent] PROFILE_CONTEXT_RESET " + profile);
        }

        public void RunQuery(string query)
        {
            if (string.IsNullOrEmpty(query) || string.IsNullOrWhiteSpace(query)) { SetState("enter a question"); return; }
            if (Time.frameCount == _lastSubmitFrame) return; // §2 same-frame dup guard (Enter + click)
            _lastSubmitFrame = Time.frameCount;
            _controller.RunQuery(Profile + "-demo", query, _scene, "document", (o) =>
            {
                if (o.response != null)
                {
                    _answer.text = o.response.text;
                    _grounded.text = o.response.grounded ? "GROUNDED" : "UNGROUNDED";
                    _grounded.color = o.response.grounded ? ShadowDesignTokens.Verified : ShadowDesignTokens.Warning;
                    ShowCitations(o.response.citations);
                    if (o.response.verification_summary != null) _actionStatus.text = "record integrity: " + o.response.verification_summary.record_integrity;
                }
                if (o.records != null && o.records.Count > 0) _actionStatus.text = o.records.Count + " action(s) · verdict " + o.verdict;
            });
        }

        void ShowCitations(ShadowCitationModel[] cites)
        {
            ClearCitations();
            if (cites == null) return;
            foreach (var cit in cites)
            {
                var chip = new GameObject("chip", typeof(Image), typeof(LayoutElement)); chip.transform.SetParent(_citations, false);
                chip.GetComponent<Image>().color = ShadowDesignTokens.PanelSecondary;
                chip.GetComponent<Image>().gameObject.AddComponent<Outline>().effectColor = ShadowDesignTokens.Border;
                chip.GetComponent<LayoutElement>().minWidth = 160; chip.GetComponent<LayoutElement>().minHeight = 24;
                var t = Centered(chip.transform, cit.source_id + ": " + Trunc(cit.quote, 16), 12, ShadowDesignTokens.TextPrimary);
                t.alignment = TextAnchor.MiddleLeft; t.rectTransform.offsetMin = new Vector2(8, 0);
            }
        }

        // IShadowActionStatusView
        public void SetLastAction(string line) { if (_lastAction) _lastAction.text = line; }
        public void SetState(string state) { if (_state) { _state.text = state; _state.color = ShadowDesignTokens.StatusColor(state); } }
        void SetFocus(string s) { if (_focus) _focus.text = s; }

        void ClearAnswer() { if (_answer) _answer.text = "Ask a grounded question about this evidence."; if (_grounded) _grounded.text = ""; ClearCitations(); if (_focus) _focus.text = ""; if (_actionStatus) _actionStatus.text = ""; }

        // per-query transient clear (the controller's OnBeginQuery hook) — clears prior answer,
        // citations, action status, focus, and LAST ACTION. Does NOT touch profile/session/verification.
        void ClearTransient()
        {
            ClearAnswer();
            if (_lastAction) _lastAction.text = "LAST ACTION: —";
        }

        void SetControlsEnabled(bool enabled)
        {
            if (_input) _input.interactable = enabled;
            if (_askButton) _askButton.interactable = enabled;
        }
        void ClearCitations() { if (_citations) foreach (Transform t in _citations) Destroy(t.gameObject); }
        void UpdatePlaceholder()
        {
            if (_placeholder == null) return;
            _placeholder.text = Profile == "data-science-v1" ? "Ask why this model was selected…"
                : Profile == "coding-agent-v1" ? "Ask about a change, command or test…"
                : "Ask about this decision or its sources…";
        }
        void HighlightSelected()
        {
            foreach (var kv in _segButtons) kv.Value.color = (kv.Key == Profile) ? ShadowDesignTokens.Information : ShadowDesignTokens.PanelPrimary;
        }
        static string DisplayName(string id) { foreach (var (pid, label) in PROFILES) if (pid == id) return label; return id; }
        static string Trunc(string s, int n) => string.IsNullOrEmpty(s) ? "" : (s.Length <= n ? s : s.Substring(0, n));

        // ── tiny UI builders (region-relative; no absolute coords) ──
        Image FillPanel(RectTransform region, string name, Color color)
        {
            var go = new GameObject(name, typeof(Image)); go.transform.SetParent(region, false);
            var img = go.GetComponent<Image>(); img.color = color; Fill(img.rectTransform);
            var o = go.AddComponent<Outline>(); o.effectColor = ShadowDesignTokens.Border; o.effectDistance = new Vector2(1, 1);
            return img;
        }
        static void Fill(RectTransform rt) { rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.offsetMin = Vector2.zero; rt.offsetMax = Vector2.zero; }
        RectTransform VLayout(Transform parent, float spacing, RectOffset pad)
        {
            var go = new GameObject("VCol", typeof(RectTransform), typeof(VerticalLayoutGroup)); go.transform.SetParent(parent, false);
            var rt = go.GetComponent<RectTransform>(); Fill(rt);
            var v = go.GetComponent<VerticalLayoutGroup>(); v.spacing = spacing; v.padding = pad; v.childControlWidth = true; v.childForceExpandWidth = true; v.childControlHeight = false;
            return rt;
        }
        RectTransform Row(Transform parent, float h)
        {
            var go = new GameObject("Row", typeof(RectTransform), typeof(LayoutElement)); go.transform.SetParent(parent, false);
            go.GetComponent<LayoutElement>().minHeight = h; return go.GetComponent<RectTransform>();
        }
        Text Left(Transform parent, string s, int size, Color c) { var t = Label(parent, s, size, c, TextAnchor.MiddleLeft, 0); var rt = t.rectTransform; rt.anchorMin = new Vector2(0, 0); rt.anchorMax = new Vector2(0.6f, 1); Fill2(rt); return t; }
        Text Right(Transform parent, string s, int size, Color c) { var t = Label(parent, s, size, c, TextAnchor.MiddleRight, 0); var rt = t.rectTransform; rt.anchorMin = new Vector2(0.4f, 0); rt.anchorMax = new Vector2(1, 1); Fill2(rt); return t; }
        static void Fill2(RectTransform rt) { rt.offsetMin = Vector2.zero; rt.offsetMax = Vector2.zero; }
        Text Label(Transform parent, string text, int size, Color color, TextAnchor align, float minH)
        {
            var go = new GameObject("Text", typeof(Text), typeof(LayoutElement)); go.transform.SetParent(parent, false);
            var t = go.GetComponent<Text>(); t.font = _font; t.text = text; t.fontSize = size; t.color = color; t.alignment = align;
            t.horizontalOverflow = HorizontalWrapMode.Wrap; t.verticalOverflow = VerticalWrapMode.Overflow;
            if (minH > 0) go.GetComponent<LayoutElement>().minHeight = minH;
            return t;
        }
        Text Centered(Transform parent, string s, int size, Color c)
        {
            var t = Label(parent, s, size, c, TextAnchor.MiddleCenter, 0); Fill(t.rectTransform); return t;
        }
    }
}
#endif
