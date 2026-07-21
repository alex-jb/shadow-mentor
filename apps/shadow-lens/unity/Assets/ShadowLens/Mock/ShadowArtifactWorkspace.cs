// apps/shadow-lens/unity/Assets/ShadowLens/Mock/ShadowArtifactWorkspace.cs
// One shared Shadow Lens shell, one artifact adapter PER PROFILE. Each workspace builds its OWN
// artifact content; only the active one is visible — so switching to Data Science never shows the
// loan document, and vice-versa. SOURCE AUTHORED · compiled in Unity 6.
#if UNITY_2020_1_OR_NEWER
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using ShadowLens.Design;

namespace ShadowLens.Mock
{
    public interface IShadowArtifactWorkspace
    {
        string ProfileId { get; }
        string ArtifactTitle { get; }
        void Build(Transform parent, Camera cam, Font font);
        void SetActive(bool on);
        bool IsActive { get; }
        void ResetView();
        bool Highlight(string id);
        bool Focus(string id);
        bool Contains(string id);
    }

    // World-space artifact base: a dark panel in front of the camera with a titled node list.
    public abstract class ShadowArtifactWorkspaceBase : IShadowArtifactWorkspace
    {
        protected GameObject Root;
        protected Font Font;
        protected Camera Cam;
        protected readonly Dictionary<string, Image> Nodes = new Dictionary<string, Image>();
        protected readonly Dictionary<string, Color> _base = new Dictionary<string, Color>();
        RectTransform _list;

        public abstract string ProfileId { get; }
        public string ArtifactTitle { get; protected set; } = "ARTIFACT";
        public bool IsActive => Root && Root.activeSelf;

        public void Build(Transform parent, Camera cam, Font font)
        {
            Cam = cam; Font = font;
            var pos = cam != null ? cam.transform.position + cam.transform.forward * 1.45f + cam.transform.right * -0.18f - cam.transform.up * 0.05f : new Vector3(-0.2f, 1.45f, -1.45f);
            var go = new GameObject("Artifact_" + ProfileId, typeof(Canvas)); go.transform.SetParent(parent, false);
            go.transform.position = pos;
            if (cam != null) go.transform.rotation = Quaternion.LookRotation(pos - cam.transform.position, cam.transform.up);
            go.GetComponent<Canvas>().renderMode = RenderMode.WorldSpace;
            var rt = go.GetComponent<RectTransform>(); rt.sizeDelta = new Vector2(620, 820); rt.localScale = Vector3.one * 0.00165f;
            Root = go;
            var bg = Panel(go.transform, "Bg", ShadowDesignTokens.PanelPrimary, Vector2.zero, new Vector2(620, 820), new Vector2(0.5f, 0.5f));
            Text(bg.transform, ArtifactTitle, 30, new Vector2(0.5f, 1f), new Vector2(0, -28), ShadowDesignTokens.TextPrimary, TextAnchor.UpperCenter);
            _list = new GameObject("List", typeof(RectTransform), typeof(VerticalLayoutGroup)).GetComponent<RectTransform>();
            _list.SetParent(bg.transform, false); _list.anchorMin = new Vector2(0, 0); _list.anchorMax = new Vector2(1, 1); _list.offsetMin = new Vector2(30, 30); _list.offsetMax = new Vector2(-30, -80);
            var v = _list.GetComponent<VerticalLayoutGroup>(); v.spacing = 10; v.childForceExpandHeight = false; v.childControlHeight = false;
            BuildContent();
            SetActive(false);
        }
        protected abstract void BuildContent();

        // A plain metadata line.
        protected void Line(string text, Color color)
        {
            var t = Text(_list, text, 26, new Vector2(0, 1), Vector2.zero, color, TextAnchor.MiddleLeft);
            t.gameObject.AddComponent<LayoutElement>().minHeight = 40;
        }
        // A highlightable node (has an id the agent can focus/highlight).
        protected void Node(string id, string text)
        {
            var card = Panel(_list, "Node_" + id, ShadowDesignTokens.PanelSecondary, Vector2.zero, new Vector2(0, 48), new Vector2(0.5f, 0.5f));
            card.gameObject.AddComponent<LayoutElement>().minHeight = 48;
            var t = Text(card.transform, text, 24, new Vector2(0, 0.5f), new Vector2(12, 0), ShadowDesignTokens.TextPrimary, TextAnchor.MiddleLeft);
            t.rectTransform.anchorMax = new Vector2(1, 0.5f); t.rectTransform.offsetMax = new Vector2(-12, t.rectTransform.offsetMax.y);
            Nodes[id] = card; _base[id] = card.color;
        }

        public void SetActive(bool on) { if (Root) Root.SetActive(on); if (!on) ResetView(); }
        public void ResetView() { foreach (var kv in Nodes) if (kv.Value) kv.Value.color = _base[kv.Key]; }
        public bool Contains(string id) => Nodes.ContainsKey(id);
        public bool Highlight(string id) { if (!Nodes.TryGetValue(id, out var n) || !n) return false; n.color = ShadowDesignTokens.Information; return true; }
        public bool Focus(string id) => Highlight(id);

        // builders
        protected Image Panel(Transform parent, string name, Color color, Vector2 pos, Vector2 size, Vector2 anchor)
        {
            var go = new GameObject(name, typeof(Image)); go.transform.SetParent(parent, false);
            var img = go.GetComponent<Image>(); img.color = color;
            var rt = img.rectTransform; rt.anchorMin = rt.anchorMax = rt.pivot = anchor; rt.anchoredPosition = pos; rt.sizeDelta = size;
            go.AddComponent<Outline>().effectColor = ShadowDesignTokens.Border;
            return img;
        }
        protected Text Text(Transform parent, string s, int size, Vector2 anchor, Vector2 pos, Color color, TextAnchor align)
        {
            var go = new GameObject("Text", typeof(Text)); go.transform.SetParent(parent, false);
            var t = go.GetComponent<Text>(); t.font = Font; t.text = s; t.fontSize = size; t.color = color; t.alignment = align;
            t.horizontalOverflow = HorizontalWrapMode.Overflow; t.verticalOverflow = VerticalWrapMode.Overflow;
            var rt = t.rectTransform; rt.anchorMin = rt.anchorMax = rt.pivot = anchor; rt.anchoredPosition = pos; rt.sizeDelta = new Vector2(540, 44);
            return t;
        }
    }

    // Banking: a thin adapter over the EXISTING loan document + source overlay in ShadowLensMockView
    // (keeps the confirmed banking highlight behavior). Toggles the world document + routes B0L1.
    public class ShadowBankingWorkspace : IShadowArtifactWorkspace
    {
        readonly ShadowLensMockView _view;
        public ShadowBankingWorkspace(ShadowLensMockView view) { _view = view; }
        public string ProfileId => "banking-v1";
        public string ArtifactTitle => "LOAN APPLICATION — FIXTURE";
        public void Build(Transform parent, Camera cam, Font font) { /* built by MockView */ }
        public void SetActive(bool on) { _view.SetBankingDocumentActive(on); if (!on) ResetView(); }
        public bool IsActive => _view.BankingDocumentActive;
        public void ResetView() { _view.SetReady(); }
        public bool Contains(string id) => id == "B0L1" || id == "c1" || id == "capture" || id == "verify";
        public bool Highlight(string id) { if (id == "B0L1") { _view.ShowSource(); return true; } return false; }
        public bool Focus(string id) => Highlight(id);
    }
}
#endif
