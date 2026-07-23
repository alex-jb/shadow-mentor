// apps/shadow-lens/unity/Assets/ShadowLens/Workspace/ShadowAuditWorkspace.cs
// The Audit Workspace MonoBehaviour root — the DEFAULT V11 product view. It subscribes to the real
// guided-story state and renders the compact 2.5D layout (TOP header / LEFT source / CENTER focus /
// RIGHT trust strip / BOTTOM evidence rail + actions) from ShadowAuditWorkspaceModel. Status identity
// comes from generated tokens (ShadowStatusGlyph); colours from the visual-profile resolver. It does
// NOT duplicate story data and rebuilds incrementally per region rather than the whole workspace.
// Rendering primitives are stable (TextMesh + shared materials) to stay compile-robust; the tested
// logic lives in the pure model/glyph/metrics classes. Visual/OST validation is a PlayMode/capture
// concern, not claimed here.
#if UNITY_2020_1_OR_NEWER
using System.Collections.Generic;
using UnityEngine;
using ShadowLens.Design;
using ShadowLens.GuidedStory;
using P = ShadowLens.Design.ShadowDesignTokens.ShadowVisualProfile;

namespace ShadowLens.Workspace
{
    public sealed class ShadowAuditWorkspace : MonoBehaviour
    {
        public ShadowPresentationMode Mode = ShadowPresentationMode.AuditWorkspace;
        public P Profile = P.DesktopDark;
        public bool Zh = false;
        public string Tracking = "TRACKED_3DOF";

        GuidedStorySemantic _model;
        ShadowGuidedStoryState _state;
        string _focusEntityId;

        // shared material cache keyed by colour hex — never one material per card (§15)
        static readonly Dictionary<string, Material> _matCache = new Dictionary<string, Material>();
        readonly Dictionary<string, GameObject> _regions = new Dictionary<string, GameObject>();

        public void Bind(GuidedStorySemantic model, ShadowGuidedStoryState state)
        {
            _model = model; _state = state;
            var step = state?.CurrentStep;
            _focusEntityId = (step != null && step.FocusEntities.Count > 0) ? step.FocusEntities[0] : model?.Entities.Count > 0 ? model.Entities[0].Id : null;
            RebuildAll();
        }

        static Material SharedMat(string hex)
        {
            if (!_matCache.TryGetValue(hex, out var m) || m == null)
            {
                var c = Hex(hex);
                m = new Material(Shader.Find("Unlit/Color")) { color = c };
                _matCache[hex] = m;
            }
            return m;
        }

        static Color Hex(string hex)
        {
            if (ColorUtility.TryParseHtmlString(hex, out var c)) return c;
            return Color.gray;
        }

        GameObject Region(string key, Vector3 pos)
        {
            if (_regions.TryGetValue(key, out var go) && go != null) { foreach (Transform t in go.transform) Destroy(t.gameObject); return go; }
            go = new GameObject("region." + key); go.transform.SetParent(transform, false); go.transform.localPosition = pos;
            _regions[key] = go; return go;
        }

        void RebuildAll()
        {
            if (Mode != ShadowPresentationMode.AuditWorkspace) return; // PrimitiveDiagnostic handled elsewhere
            var sc = _state?.CurrentScenario;
            var focus = ShadowAuditWorkspaceModel.BuildFocus(_model, sc, _focusEntityId, Zh);
            RebuildHeader(focus);
            RebuildSource();
            RebuildFocus(focus);
            RebuildTrustStrip(focus);
            RebuildRail(sc);
        }

        void RebuildHeader(CurrentFocusVM focus)
        {
            var r = Region("top", new Vector3(0, 1.1f, 0));
            Label(r, _model?.Title?.Pick(Zh) ?? "Shadow Audit", 0.09f, ThemeText(), new Vector3(-1.6f, 0, 0));
            Label(r, "tracking: " + Tracking, 0.05f, ThemeText(), new Vector3(0.9f, 0, 0));
            Label(r, "SIMULATED — NOT DEVICE VALIDATED", 0.04f, Hex("#961418"), new Vector3(0.9f, -0.12f, 0));
            if (ShadowTrackingBanner.IsDegraded(Tracking) || Tracking == "SCANNING")
                Label(r, ShadowTrackingBanner.Copy(Tracking, Zh), 0.045f, Hex("#fbbf24"), new Vector3(-1.6f, -0.18f, 0));
        }

        void RebuildSource()
        {
            var r = Region("left", new Vector3(-1.7f, 0.2f, 0));
            var src = ShadowAuditWorkspaceModel.BuildSource(_model?.EntityById(_focusEntityId));
            Label(r, "SOURCE", 0.05f, ThemeSecondary(), Vector3.zero);
            Label(r, src.SourceName, 0.055f, ThemeText(), new Vector3(0, -0.14f, 0));
            Label(r, "loc: " + src.Location, 0.042f, ThemeSecondary(), new Vector3(0, -0.26f, 0));
            Label(r, "resolution: " + src.Resolution, 0.042f, GlyphColor(src.Resolution == "PRESENT" ? "VERIFIED" : "NOT_PRESENT"), new Vector3(0, -0.36f, 0));
            Label(r, "OCR: " + src.Ocr, 0.042f, GlyphColor("NOT_EVALUATED"), new Vector3(0, -0.46f, 0));
        }

        void RebuildFocus(CurrentFocusVM focus)
        {
            var r = Region("center", new Vector3(0, 0.2f, 0.05f));
            // dominant title
            Label(r, ShadowLabelMetrics.TruncateWithAffordance(focus.Title, 18f), 0.085f, ThemeText(), Vector3.zero);
            Label(r, "role: " + focus.Role, 0.045f, ThemeSecondary(), new Vector3(0, -0.14f, 0));
            float y = -0.26f;
            foreach (var f in focus.Fields)
            {
                var g = ShadowStatusGlyph.Resolve(f.Status);
                Label(r, f.Label + ": " + f.Value, 0.05f, Hex(g.ColorHex), new Vector3(0, y, 0));
                y -= 0.11f;
            }
            if (focus.IsFirstFailure)
                Label(r, "◆ FIRST FAILURE", 0.06f, GlyphColor("FIRST_FAILURE"), new Vector3(0, y - 0.02f, 0));
            Label(r, "▶ " + focus.NextAction, 0.05f, GlyphColor("APPROVAL_PRESENT"), new Vector3(0, y - 0.16f, 0));
            Label(r, "[ OPEN 2D AUDIT ]", 0.05f, ThemeText(), new Vector3(0, y - 0.28f, 0));
        }

        void RebuildTrustStrip(CurrentFocusVM focus)
        {
            var r = Region("right", new Vector3(1.7f, 0.2f, 0));
            Label(r, "TRUST", 0.05f, ThemeSecondary(), Vector3.zero);
            float y = -0.14f;
            foreach (var grp in ShadowAuditWorkspaceModel.BuildTrustStrip(focus))
            {
                Label(r, grp.Label, 0.045f, ThemeText(), new Vector3(0, y, 0));
                Label(r, grp.Glyph.Text, 0.045f, Hex(grp.Glyph.ColorHex), new Vector3(0, y - 0.08f, 0));
                y -= 0.22f;
            }
        }

        void RebuildRail(StoryScenario sc)
        {
            var r = Region("bottom", new Vector3(0, -1.0f, 0));
            var items = ShadowAuditWorkspaceModel.BuildRail(_model, sc, _focusEntityId);
            float x = -1.8f;
            foreach (var it in items)
            {
                float size = it.IsCurrent ? 0.06f : 0.04f;
                var col = Hex(it.Glyph.ColorHex);
                Quad(r, new Vector3(x, 0, 0), it.IsFirstFailure ? "#ef4444" : it.IsDownstream ? "#8a92a0" : it.Glyph.ColorHex, it.IsCurrent ? 0.16f : 0.10f);
                Label(r, "#" + it.Sequence, size, col, new Vector3(x, -0.14f, 0));
                if (it.IsFirstFailure) Label(r, "FIRST", 0.035f, GlyphColor("FIRST_FAILURE"), new Vector3(x, 0.12f, 0));
                if (it.IsDownstream) Label(r, "↓dep", 0.032f, GlyphColor("AFFECTED_DOWNSTREAM"), new Vector3(x, 0.12f, 0));
                x += 0.5f;
            }
            Label(r, "◀ Prev   ▶ Next   ⟳ Reset   ⌖ Recenter   [ OPEN 2D AUDIT ]", 0.04f, ThemeSecondary(), new Vector3(-1.8f, -0.3f, 0));
        }

        // ── primitives (shared materials) ──
        TextMesh Label(GameObject parent, string text, float size, Color color, Vector3 local)
        {
            var go = new GameObject("t"); go.transform.SetParent(parent.transform, false); go.transform.localPosition = local;
            var tm = go.AddComponent<TextMesh>();
            tm.text = text; tm.characterSize = size; tm.fontSize = 64; tm.color = color; tm.anchor = TextAnchor.UpperLeft;
            return tm;
        }

        void Quad(GameObject parent, Vector3 local, string hex, float scale)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Quad);
            Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent.transform, false); go.transform.localPosition = local; go.transform.localScale = Vector3.one * scale;
            go.GetComponent<Renderer>().sharedMaterial = SharedMat(hex);
        }

        Color ThemeText() => ShadowDesignTokens.Resolve(Profile).TextPrimary;
        Color ThemeSecondary() => ShadowDesignTokens.Resolve(Profile).TextSecondary;
        Color GlyphColor(string status) => Hex(ShadowStatusGlyph.Resolve(status).ColorHex);

        // Mode switch preserving state (§6).
        public void SwitchMode(ShadowPresentationMode target)
        {
            var st = new ShadowWorkspaceState { StepIndex = _state?.StepIndex ?? 0, FocusEntityId = _focusEntityId, Zh = Zh, Tracking = Tracking };
            var (mode, _) = ShadowPresentationModes.SwitchMode(target, st);
            Mode = mode; RebuildAll();
        }
    }
}
#endif
