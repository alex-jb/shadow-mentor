// apps/shadow-lens/unity/Assets/ShadowLens/Mock/ShadowSpatialAgentPanel.cs
// Gate 2 — the visible spatial-agent surface added to the existing scene: Query Bar, Grounded
// Answer Card (answer + grounded badge + profile + action status + citation chips), LAST ACTION
// line, and a Banking/Data Science/Coding profile selector. It wires the tested protocol
// (ShadowSpatialQueryController) with a deterministic offline transport + a bridge to the existing
// ShadowLensMockView — the existing Analyze/Show Source/Show Audit/Verify/Tamper/Reset buttons and
// all evidence/verification behavior are UNTOUCHED. No live LLM. SOURCE AUTHORED · compiled in
// Unity 6 (Gate 2). No XREAL/Android device validation claimed.
#if UNITY_2020_1_OR_NEWER
using System.Collections.Generic;
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
        public string Profile = "banking-v1";

        Font _font;
        Text _answer, _grounded, _profileLbl, _actionStatus, _lastAction, _focus, _state;
        InputField _input;
        Transform _citations;
        ShadowSpatialQueryController _controller;
        ShadowSpatialSceneIndex _scene;
        bool _built;

        // ── test accessors ──
        public string AnswerText => _answer ? _answer.text : "";
        public string LastActionText => _lastAction ? _lastAction.text : "";
        public string FocusText => _focus ? _focus.text : "";
        public string GroundedText => _grounded ? _grounded.text : "";
        public string StateText => _state ? _state.text : "";
        public int CitationCount => _citations ? _citations.childCount : 0;

        void Awake() { Build(); }

        public void Build()
        {
            if (_built) return;
            _font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            var canvasGo = new GameObject("ShadowSpatialAgentHUD", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasGo.transform.SetParent(transform, false);
            canvasGo.GetComponent<Canvas>().renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.GetComponent<CanvasScaler>(); scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize; scaler.referenceResolution = new Vector2(1280, 720);
            var c = canvasGo.transform;

            // Grounded Answer Card (right, mid) — panel + answer + grounded badge + profile + action status
            var card = Panel(c, "AnswerCard", new Vector2(1f, 0.5f), new Vector2(-20, 40), new Vector2(400, 300));
            Label(card.transform, "GROUNDED ANSWER", 12, new Vector2(0, 1f), new Vector2(12, -10), ShadowDesignTokens.Information, TextAnchor.UpperLeft);
            _grounded = Label(card.transform, "—", 12, new Vector2(1, 1f), new Vector2(-12, -10), ShadowDesignTokens.Neutral, TextAnchor.UpperRight);
            _profileLbl = Label(card.transform, Profile, 12, new Vector2(0, 1f), new Vector2(12, -30), ShadowDesignTokens.TextSecondary, TextAnchor.UpperLeft);
            _answer = Label(card.transform, "Ask a grounded question…", 16, new Vector2(0, 1f), new Vector2(12, -56), ShadowDesignTokens.TextPrimary, TextAnchor.UpperLeft); _answer.rectTransform.sizeDelta = new Vector2(376, 120);
            _actionStatus = Label(card.transform, "", 13, new Vector2(0, 0f), new Vector2(12, 44), ShadowDesignTokens.TextSecondary, TextAnchor.LowerLeft);
            _focus = Label(card.transform, "", 13, new Vector2(0, 0f), new Vector2(12, 24), ShadowDesignTokens.Information, TextAnchor.LowerLeft);
            var citeHost = new GameObject("Citations", typeof(RectTransform), typeof(HorizontalLayoutGroup)); citeHost.transform.SetParent(card.transform, false);
            var chr = citeHost.GetComponent<RectTransform>(); chr.anchorMin = new Vector2(0, 0); chr.anchorMax = new Vector2(1, 0); chr.pivot = new Vector2(0, 0); chr.anchoredPosition = new Vector2(12, 8); chr.sizeDelta = new Vector2(-24, 26);
            citeHost.GetComponent<HorizontalLayoutGroup>().spacing = 6;
            _citations = citeHost.transform;

            // Query Bar (bottom center) + submit
            var bar = Panel(c, "QueryBar", new Vector2(0.5f, 0f), new Vector2(0, 60), new Vector2(760, 44));
            var inputGo = new GameObject("Input", typeof(Image), typeof(InputField)); inputGo.transform.SetParent(bar.transform, false);
            var irt = inputGo.GetComponent<RectTransform>(); irt.anchorMin = new Vector2(0, 0.5f); irt.anchorMax = new Vector2(1, 0.5f); irt.pivot = new Vector2(0, 0.5f); irt.offsetMin = new Vector2(8, -16); irt.offsetMax = new Vector2(-96, 16);
            inputGo.GetComponent<Image>().color = ShadowDesignTokens.Background;
            var placeholder = Label(inputGo.transform, "Ask a grounded question…", 15, new Vector2(0, 0.5f), new Vector2(8, 0), ShadowDesignTokens.TextSecondary, TextAnchor.MiddleLeft);
            var textComp = Label(inputGo.transform, "", 15, new Vector2(0, 0.5f), new Vector2(8, 0), ShadowDesignTokens.TextPrimary, TextAnchor.MiddleLeft);
            _input = inputGo.GetComponent<InputField>(); _input.textComponent = textComp; _input.placeholder = placeholder;
            var submit = Button(bar.transform, "Ask", new Vector2(1, 0.5f), new Vector2(-8, 0), () => RunQuery(_input.text));
            submit.GetComponent<RectTransform>().sizeDelta = new Vector2(76, 32);
            _input.onSubmit.AddListener(RunQuery);

            _lastAction = Label(c, "LAST ACTION: —", 12, new Vector2(0, 0f), new Vector2(20, 96), ShadowDesignTokens.TextSecondary, TextAnchor.LowerLeft);
            _state = Label(c, "READY", 12, new Vector2(0, 0f), new Vector2(20, 116), ShadowDesignTokens.Neutral, TextAnchor.LowerLeft);

            // Profile selector (top center)
            var sel = new GameObject("ProfileSelector", typeof(RectTransform), typeof(HorizontalLayoutGroup)); sel.transform.SetParent(c, false);
            var srt = sel.GetComponent<RectTransform>(); srt.anchorMin = srt.anchorMax = srt.pivot = new Vector2(0.5f, 1f); srt.anchoredPosition = new Vector2(0, -190); srt.sizeDelta = new Vector2(520, 32);
            sel.GetComponent<HorizontalLayoutGroup>().spacing = 8;
            foreach (var p in new[] { "banking-v1", "data-science-v1", "coding-agent-v1" })
            {
                var pp = p; var b = Button(sel.transform, p, new Vector2(0, 0.5f), Vector2.zero, () => SetProfile(pp));
                b.GetComponent<RectTransform>().sizeDelta = new Vector2(160, 30);
            }

            Rewire();
            _built = true;
        }

        void Rewire()
        {
            var cfg = new ShadowSpatialAgentConfig { Profile = Profile, UseFixtureTransport = true };
            var transport = new ShadowSpatialAgentMockTransport { Responder = ShadowSpatialDemoFixtures.ResponderFor(Profile) };
            var client = new ShadowSpatialAgentClient(cfg, transport);
            var bridge = new ShadowLensRendererBridge(View, SetFocus);
            _controller = new ShadowSpatialQueryController(client, bridge, new ShadowSpatialAgentStateMachine(), this, new ShadowActionExecutionReporter { Platform = "unity" });
            _scene = new ShadowSpatialSceneIndex(ShadowSpatialDemoFixtures.SceneFor(Profile));
            if (_profileLbl) _profileLbl.text = Profile;
        }

        public void SetProfile(string profile) { Profile = profile; Rewire(); if (View) View.SetReady(); ClearAnswer(); }

        public void RunQuery(string query)
        {
            if (string.IsNullOrEmpty(query) || string.IsNullOrWhiteSpace(query)) { SetState("enter a question"); return; }
            ClearCitations();
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
                var chip = Panel(_citations, "chip", new Vector2(0, 0.5f), Vector2.zero, new Vector2(180, 24));
                Label(chip.transform, cit.source_id + ": " + Trunc(cit.quote, 18), 11, new Vector2(0, 0.5f), new Vector2(8, 0), ShadowDesignTokens.TextPrimary, TextAnchor.MiddleLeft);
            }
        }

        // IShadowActionStatusView
        public void SetLastAction(string line) { if (_lastAction) _lastAction.text = line; }
        public void SetState(string state) { if (_state) { _state.text = state; _state.color = ShadowDesignTokens.StatusColor(state); } }
        void SetFocus(string s) { if (_focus) _focus.text = s; }
        void ClearAnswer() { if (_answer) _answer.text = "Ask a grounded question…"; if (_grounded) _grounded.text = "—"; ClearCitations(); if (_focus) _focus.text = ""; }
        void ClearCitations() { if (_citations) foreach (Transform t in _citations) Destroy(t.gameObject); }
        static string Trunc(string s, int n) => string.IsNullOrEmpty(s) ? "" : (s.Length <= n ? s : s.Substring(0, n));

        // ── tiny UI builders ──
        Image Panel(Transform parent, string name, Vector2 anchor, Vector2 pos, Vector2 size)
        {
            var go = new GameObject(name, typeof(Image)); go.transform.SetParent(parent, false);
            var img = go.GetComponent<Image>(); img.color = ShadowDesignTokens.PanelPrimary;
            var rt = img.rectTransform; rt.anchorMin = rt.anchorMax = rt.pivot = anchor; rt.anchoredPosition = pos; rt.sizeDelta = size;
            var o = go.AddComponent<Outline>(); o.effectColor = ShadowDesignTokens.Border; o.effectDistance = new Vector2(1, 1);
            return img;
        }
        Text Label(Transform parent, string text, int size, Vector2 anchor, Vector2 pos, Color color, TextAnchor align)
        {
            var go = new GameObject("Text", typeof(Text)); go.transform.SetParent(parent, false);
            var t = go.GetComponent<Text>(); t.font = _font; t.text = text; t.fontSize = size; t.color = color; t.alignment = align;
            t.horizontalOverflow = HorizontalWrapMode.Overflow; t.verticalOverflow = VerticalWrapMode.Overflow;
            var rt = t.rectTransform; rt.anchorMin = rt.anchorMax = rt.pivot = anchor; rt.anchoredPosition = pos; rt.sizeDelta = new Vector2(380, 40);
            return t;
        }
        Button Button(Transform parent, string label, Vector2 anchor, Vector2 pos, System.Action onClick)
        {
            var go = new GameObject("Btn_" + label, typeof(Image), typeof(Button)); go.transform.SetParent(parent, false);
            go.GetComponent<Image>().color = ShadowDesignTokens.PanelSecondary;
            var rt = go.GetComponent<RectTransform>(); rt.anchorMin = rt.anchorMax = rt.pivot = anchor; rt.anchoredPosition = pos; rt.sizeDelta = new Vector2(150, 30);
            Label(go.transform, label, 13, new Vector2(0.5f, 0.5f), Vector2.zero, ShadowDesignTokens.TextPrimary, TextAnchor.MiddleCenter).rectTransform.sizeDelta = new Vector2(150, 30);
            var b = go.GetComponent<Button>(); b.onClick.RemoveAllListeners(); b.onClick.AddListener(() => onClick());
            return b;
        }
    }
}
#endif
