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
        public Font LabelFont;   // assign a CJK-capable font so Simplified Chinese renders

        GuidedStorySemantic _model;
        ShadowGuidedStoryState _state;
        StoryScenario _scenario;
        string _focusEntityId;

        // shared material cache keyed by colour hex — never one material per card (§15)
        static readonly Dictionary<string, Material> _matCache = new Dictionary<string, Material>();
        readonly Dictionary<string, GameObject> _regions = new Dictionary<string, GameObject>();

        public void Bind(GuidedStorySemantic model, ShadowGuidedStoryState state)
        {
            _model = model; _state = state; _scenario = state?.CurrentScenario;
            var step = state?.CurrentStep;
            _focusEntityId = (step != null && step.FocusEntities.Count > 0) ? step.FocusEntities[0] : model?.Entities.Count > 0 ? model.Entities[0].Id : null;
            RebuildAll();
        }

        // Direct bind for capture/tests — set the model + scenario + focus explicitly (no player/state).
        public void BindDirect(GuidedStorySemantic model, StoryScenario scenario, string focusEntityId)
        {
            _model = model; _state = null; _scenario = scenario; _focusEntityId = focusEntityId;
            RebuildAll();
        }

        public void FocusOn(string entityId) { _focusEntityId = entityId; RebuildAll(); }
        public void SetZh(bool zh) { Zh = zh; RebuildAll(); }
        public void SetTracking(string t) { Tracking = t; RebuildAll(); }

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
            var sc = _scenario;
            var focus = ShadowAuditWorkspaceModel.BuildFocus(_model, sc, _focusEntityId, Zh);
            RebuildHeader(focus);
            RebuildSource();
            RebuildFocus(focus);
            RebuildTrustStrip(focus);
            RebuildRail(sc);
        }

        // Small world-space type scale so regions do not collide. Latin+CJK both readable at capture res.
        const float T_TITLE = 0.052f, T_HEAD = 0.03f, T_LABEL = 0.03f, T_BODY = 0.026f, T_SMALL = 0.022f;
        static string Cut(string s, float em) => ShadowLabelMetrics.TruncateWithAffordance(s ?? "", em);

        void RebuildHeader(CurrentFocusVM focus)
        {
            var r = Region("top", new Vector3(-3.3f, 2.0f, 0));
            Label(r, Cut(_model?.Title?.Pick(Zh) ?? "Shadow Audit", 22f), T_TITLE, ThemeText(), Vector3.zero);
            Label(r, "tracking: " + Tracking, T_HEAD, ThemeText(), new Vector3(0, -0.24f, 0));
            Label(r, "SIMULATED — NOT DEVICE VALIDATED", T_SMALL, Hex("#961418"), new Vector3(0, -0.38f, 0));
            if (ShadowTrackingBanner.IsDegraded(Tracking) || Tracking == "SCANNING")
                Label(r, ShadowTrackingBanner.Copy(Tracking, Zh), T_BODY, Hex("#fbbf24"), new Vector3(2.7f, 0, 0));
        }

        void RebuildSource()
        {
            var r = Region("left", new Vector3(-3.3f, 0.9f, 0));
            var src = ShadowAuditWorkspaceModel.BuildSource(_model?.EntityById(_focusEntityId));
            Label(r, "SOURCE", T_HEAD, ThemeSecondary(), Vector3.zero);
            Label(r, Cut(src.SourceName, 16f), T_LABEL, ThemeText(), new Vector3(0, -0.14f, 0));
            Label(r, "loc: " + Cut(src.Location, 14f), T_BODY, ThemeSecondary(), new Vector3(0, -0.26f, 0));
            Label(r, "resolution: " + src.Resolution, T_BODY, GlyphColor(src.Resolution == "PRESENT" ? "VERIFIED" : "NOT_PRESENT"), new Vector3(0, -0.37f, 0));
            Label(r, "OCR: " + src.Ocr, T_BODY, GlyphColor("NOT_EVALUATED"), new Vector3(0, -0.48f, 0));
        }

        void RebuildFocus(CurrentFocusVM focus)
        {
            var r = Region("center", new Vector3(-0.9f, 0.9f, 0.05f));
            Label(r, Cut(focus.Title, 20f), T_TITLE, ThemeText(), Vector3.zero); // dominant
            Label(r, "role: " + focus.Role, T_SMALL, ThemeSecondary(), new Vector3(0, -0.16f, 0));
            float y = -0.30f;
            foreach (var f in focus.Fields)
            {
                var g = ShadowStatusGlyph.Resolve(f.Status);
                Label(r, Cut(f.Label + ": " + f.Value, 15f), T_BODY, Hex(g.ColorHex), new Vector3(0, y, 0));
                y -= 0.115f;
            }
            if (focus.IsFirstFailure)
                Label(r, "◆ FIRST FAILURE", T_LABEL, GlyphColor("FIRST_FAILURE"), new Vector3(0, y - 0.02f, 0));
            y -= 0.16f;
            Label(r, "▶ " + Cut(focus.NextAction, 30f), T_BODY, GlyphColor("APPROVAL_PRESENT"), new Vector3(0, y, 0));
            Label(r, "[ OPEN 2D AUDIT ]", T_BODY, ThemeText(), new Vector3(0, y - 0.13f, 0));
        }

        void RebuildTrustStrip(CurrentFocusVM focus)
        {
            var r = Region("right", new Vector3(2.55f, 0.9f, 0));
            Label(r, "TRUST", T_HEAD, ThemeSecondary(), Vector3.zero);
            float y = -0.16f;
            foreach (var grp in ShadowAuditWorkspaceModel.BuildTrustStrip(focus))
            {
                Label(r, Cut(grp.Label, 15f), T_BODY, ThemeText(), new Vector3(0, y, 0));
                Label(r, Cut(grp.Glyph.Text, 15f), T_BODY, Hex(grp.Glyph.ColorHex), new Vector3(0, y - 0.09f, 0));
                y -= 0.24f;
            }
        }

        void RebuildRail(StoryScenario sc)
        {
            var r = Region("bottom", new Vector3(-2.4f, -1.5f, 0));
            var items = ShadowAuditWorkspaceModel.BuildRail(_model, sc, _focusEntityId);
            float x = 0f;
            foreach (var it in items)
            {
                var col = Hex(it.Glyph.ColorHex);
                Quad(r, new Vector3(x, 0, 0), it.IsFirstFailure ? "#ef4444" : it.IsDownstream ? "#8a92a0" : it.Glyph.ColorHex, it.IsCurrent ? 0.15f : 0.09f);
                Label(r, "#" + it.Sequence, it.IsCurrent ? 0.04f : 0.028f, col, new Vector3(x - 0.05f, -0.16f, 0));
                if (it.IsFirstFailure) Label(r, "FIRST", T_SMALL, GlyphColor("FIRST_FAILURE"), new Vector3(x - 0.05f, 0.16f, 0));
                if (it.IsDownstream) Label(r, "↓dep", T_SMALL, GlyphColor("AFFECTED_DOWNSTREAM"), new Vector3(x - 0.05f, 0.16f, 0));
                x += 0.62f;
            }
            Label(r, "◀ Prev   ▶ Next   ⟳ Reset   ⌖ Recenter   [ OPEN 2D AUDIT ]", T_SMALL, ThemeSecondary(), new Vector3(0, -0.34f, 0));
        }

        // ── primitives (shared materials) ──
        TextMesh Label(GameObject parent, string text, float size, Color color, Vector3 local)
        {
            var go = new GameObject("t"); go.transform.SetParent(parent.transform, false); go.transform.localPosition = local;
            var tm = go.AddComponent<TextMesh>();
            tm.text = text; tm.characterSize = size; tm.fontSize = 64; tm.color = color; tm.anchor = TextAnchor.UpperLeft;
            if (LabelFont != null) { tm.font = LabelFont; var mr = go.GetComponent<MeshRenderer>(); if (mr) mr.sharedMaterial = LabelFont.material; }
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
