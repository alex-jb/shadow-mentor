// apps/shadow-lens/unity/Assets/ShadowLens/GuidedStory/ShadowGuidedStoryPlayer.cs
// Native Unity guided-story player. No WebView / iframe, no XREAL SDK — input arrives through
// IShadowStoryInput (desktop keyboard mock here; a headset controller would implement the same
// interface elsewhere). It loads a pre-compiled semantic snapshot, spawns one primitive per node
// (shape by status), and shows each node's status as TEXT as well as shape+colour — never colour
// alone. Focus+context dims out-of-focus nodes. SOURCE AUTHORED — running this under Unity is
// verified separately; do NOT assume UNITY-COMPILED / DEVICE-VALIDATED.
#if UNITY_2020_1_OR_NEWER
using System.Collections.Generic;
using UnityEngine;
using ShadowLens.Spatial; // V3

namespace ShadowLens.GuidedStory
{
    public sealed class ShadowGuidedStoryPlayer : MonoBehaviour
    {
        [Tooltip("Pre-compiled semantic snapshots (fixtures/guided-stories/snapshots/<id>/semantic.json).")]
        public List<TextAsset> Snapshots = new List<TextAsset>();

        readonly ShadowGuidedStoryLocalization _loc = new ShadowGuidedStoryLocalization();
        DesktopMockStoryInput _input;
        GuidedStorySemantic _model;
        ShadowGuidedStoryState _state;
        int _storyIndex;
        bool _mode2D;
        readonly Dictionary<string, GameObject> _nodeObjects = new Dictionary<string, GameObject>();
        Transform _root;

        static readonly Dictionary<string, Color> ColorByKey = new Dictionary<string, Color>
        {
            { "verified", new Color(0.29f, 0.87f, 0.50f) },
            { "tampered", new Color(0.94f, 0.27f, 0.27f) },
            { "warning", new Color(0.98f, 0.75f, 0.14f) },
            { "information", new Color(0.38f, 0.65f, 0.98f) },
            { "neutral", new Color(0.54f, 0.57f, 0.63f) },
        };

        void Awake()
        {
            _input = new DesktopMockStoryInput { KeyDown = KeyDownByName };
            _root = new GameObject("GuidedStoryRoot").transform;
            _root.SetParent(transform, false);
            LoadStory(0);
        }

        static bool KeyDownByName(string k)
        {
            switch (k)
            {
                case "right": return Input.GetKeyDown(KeyCode.RightArrow);
                case "left": return Input.GetKeyDown(KeyCode.LeftArrow);
                case "n": return Input.GetKeyDown(KeyCode.N);
                case "b": return Input.GetKeyDown(KeyCode.B);
                case "r": return Input.GetKeyDown(KeyCode.R);
                case "l": return Input.GetKeyDown(KeyCode.L);
                case "f": return Input.GetKeyDown(KeyCode.F);
                default: return false;
            }
        }

        public void LoadStory(int index)
        {
            if (Snapshots == null || Snapshots.Count == 0) { Debug.LogWarning("ShadowGuidedStoryPlayer: no snapshots assigned"); return; }
            _storyIndex = ((index % Snapshots.Count) + Snapshots.Count) % Snapshots.Count;
            _model = ShadowGuidedStoryLoader.Load(Snapshots[_storyIndex].text);
            _state = new ShadowGuidedStoryState(_model);
            Rebuild();
        }

        void Update()
        {
            if (_state == null) return;
            if (_input.NextPressed()) { _state.Next(); Rebuild(); }
            else if (_input.BackPressed()) { _state.Back(); Rebuild(); }
            else if (_input.RestartPressed()) { _state.Restart(); Rebuild(); }
            else if (_input.ToggleLanguagePressed()) { _loc.Zh = !_loc.Zh; Rebuild(); }
            else if (_input.Toggle2DPressed()) { _mode2D = !_mode2D; Rebuild(); }
        }

        public void NextStory() => LoadStory(_storyIndex + 1);

        void Rebuild()
        {
            foreach (var go in _nodeObjects.Values) if (go != null) Destroy(go);
            _nodeObjects.Clear();
            if (_model == null) return;

            var step = _state.CurrentStep;
            var view = ShadowGuidedStoryUnityAdapter.Project(_model, _state.CurrentScenarioId, step.LayoutIntent ?? "timeline", step.FocusEntities);

            if (!_mode2D)
            {
                foreach (var n in view.Nodes)
                {
                    var go = GameObject.CreatePrimitive(PrimitiveForShape(n.Shape));
                    go.name = n.Id;
                    go.transform.SetParent(_root, false);
                    go.transform.localPosition = new Vector3(n.Pos.x, n.Pos.y, n.Pos.z);
                    go.transform.localScale = Vector3.one * (n.Shape == "disc" || n.Shape == "ring" ? 0.32f : 0.26f);
                    var color = ColorByKey.TryGetValue(n.ColorKey, out var c) ? c : Color.gray;
                    if (n.Dimmed) color = Color.Lerp(color, new Color(0.23f, 0.25f, 0.31f), 0.7f);
                    var r = go.GetComponent<Renderer>();
                    if (r != null) r.material.color = color;
                    // status is ALSO text (never colour alone)
                    AddLabel(go.transform, LabelFor(n));
                    if (n.IsFirstFailure) AddLabel(go.transform, _loc.Zh ? "首个失败" : "FIRST FAILURE", 0.22f);
                    _nodeObjects[n.Id] = go;
                }
            }
            LogState(view, step);
        }

        string LabelFor(StoryNodeView n)
        {
            var e = _model.EntityById(n.Id);
            string label = e != null ? _loc.Pick(e.Label) : n.Id;
            return label + " · " + n.Status.Replace('_', ' ');
        }

        void AddLabel(Transform parent, string text, float y = 0.34f)
        {
            var t = new GameObject("label").AddComponent<TextMesh>();
            t.transform.SetParent(parent, false);
            t.transform.localPosition = new Vector3(0f, y, 0f);
            t.transform.localScale = Vector3.one * 0.02f;
            t.anchor = TextAnchor.LowerCenter;
            t.fontSize = 64;
            t.characterSize = 0.5f;
            t.text = text;
        }

        void LogState(StorySceneView view, StoryStep step)
        {
            // A minimal 2D-fallback / audit surface: the full semantic state as text, so the story is
            // legible even with WebGL off. (A production build would bind this to a uGUI panel.)
            var sb = new System.Text.StringBuilder();
            sb.Append(_loc.T("fixture")).Append('\n');
            sb.Append(_loc.Pick(_model.Title)).Append(" — ").Append(_loc.Pick(step.Narration)).Append('\n');
            foreach (var d in view.Dimensions) sb.Append(d.Dimension).Append(": ").Append(d.Status).Append("  ");
            Debug.Log(sb.ToString());
        }

        static PrimitiveType PrimitiveForShape(string shape)
        {
            switch (shape)
            {
                case "icosahedron": return PrimitiveType.Sphere;
                case "pill": return PrimitiveType.Capsule;
                case "disc": case "ring": return PrimitiveType.Cylinder;
                default: return PrimitiveType.Cube; // octahedron / tetrahedron / box
            }
        }

        // Test / UI hooks (no device dependency)
        public void ApiNext() { _state?.Next(); Rebuild(); }
        public void ApiBack() { _state?.Back(); Rebuild(); }
        public void ApiRestart() { _state?.Restart(); Rebuild(); }
        public int CurrentStepIndex => _state?.StepIndex ?? -1;
        public string CurrentScenarioId => _state?.CurrentScenarioId;
    }
}
#endif
