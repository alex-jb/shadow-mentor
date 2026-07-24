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

        string LL(string key) => ShadowWorkspaceLabels.Get(key, Zh);
        // The active profile as the token layer names it. Every status colour in this component resolves
        // through it — never through the DesktopDark default (UX-01).
        string ProfileId => Profile.ToString();
        static string SV(string status, bool zh) { var g = ShadowStatusGlyph.Resolve(status); return zh ? g.TextZh : g.Text; }

        void RebuildHeader(CurrentFocusVM focus)
        {
            var r = Region("top", new Vector3(-3.3f, 2.05f, 0));
            Label(r, Cut(_model?.Title?.Pick(Zh) ?? "Shadow Audit", 22f), T_TITLE, ThemeText(), Vector3.zero);
            Label(r, LL("tracking") + ": " + (ShadowWorkspaceLabels.Has(Tracking) ? LL(Tracking) : Tracking), T_HEAD, ThemeText(), new Vector3(0, -0.30f, 0));
            Label(r, LL("simulated"), T_SMALL, Hex(ShadowStatusGlyph.DisclaimerColor(ProfileId)), new Vector3(0, -0.46f, 0));
            if (ShadowTrackingBanner.IsDegraded(Tracking) || Tracking == "SCANNING")
                Label(r, ShadowTrackingBanner.Copy(Tracking, Zh), T_BODY, Hex(ShadowStatusGlyph.FamilyColor("warning_amber", ProfileId)), new Vector3(2.9f, 0, 0));
        }

        void RebuildSource()
        {
            var r = Region("left", new Vector3(-3.3f, 1.1f, 0));
            var src = ShadowAuditWorkspaceModel.BuildSource(_model?.EntityById(_focusEntityId));
            var name = src.Resolution == "PRESENT" ? src.SourceName : LL("source_not_present");
            var loc = src.LocationAvailable ? src.Location : LL("location_not_available");
            Label(r, LL("source"), T_HEAD, ThemeSecondary(), Vector3.zero);
            Label(r, Cut(name, 16f), T_LABEL, ThemeText(), new Vector3(0, -0.18f, 0));
            Label(r, LL("loc") + ": " + Cut(loc, 14f), T_BODY, ThemeSecondary(), new Vector3(0, -0.34f, 0));
            Label(r, LL("resolution") + ": " + SV(src.Resolution == "PRESENT" ? "VERIFIED" : "NOT_PRESENT", Zh), T_BODY, GlyphColor(src.Resolution == "PRESENT" ? "VERIFIED" : "NOT_PRESENT"), new Vector3(0, -0.48f, 0));
            Label(r, LL("ocr") + ": " + SV("NOT_EVALUATED", Zh), T_BODY, GlyphColor("NOT_EVALUATED"), new Vector3(0, -0.62f, 0));
        }

        void RebuildFocus(CurrentFocusVM focus)
        {
            var r = Region("center", new Vector3(-0.9f, 1.1f, 0.05f));
            Label(r, Cut(focus.Title, 20f), T_TITLE, ThemeText(), Vector3.zero); // dominant
            Label(r, LL("role") + ": " + focus.Role, T_SMALL, ThemeSecondary(), new Vector3(0, -0.20f, 0));
            float y = -0.36f;
            foreach (var f in focus.Fields)
            {
                var g = ShadowStatusGlyph.Resolve(f.Status, ProfileId);
                string val = f.Key == "downstream" ? f.Value : SV(f.Status, Zh);
                Label(r, Cut(LL(f.Key) + ": " + val, 14f), T_BODY, Hex(g.ColorHex), new Vector3(0, y, 0));
                y -= 0.12f;
            }
            if (focus.IsFirstFailure)
                Label(r, "◆ " + LL("first_failure"), T_LABEL, GlyphColor("FIRST_FAILURE"), new Vector3(0, y - 0.02f, 0));
            y -= 0.16f;
            Label(r, "▶ " + Cut(LocalNextAction(focus), 30f), T_BODY, GlyphColor("APPROVAL_PRESENT"), new Vector3(0, y, 0));
            Label(r, "[ " + LL("open_2d_audit") + " ]", T_BODY, ThemeText(), new Vector3(0, y - 0.14f, 0));
        }

        string LocalNextAction(CurrentFocusVM f)
        {
            if (f.IsFirstFailure || f.Verification == "FAILED") return LL("open_2d_audit") + " — " + LL("inspect_first_failure");
            if (f.HumanReview == "REQUIRES_HUMAN_REVIEW") return LL("route_for_review");
            if (f.Approval == "APPROVAL_NOT_PRESENT") return LL("await_approval");
            return LL("continue_review");
        }

        void RebuildTrustStrip(CurrentFocusVM focus)
        {
            var r = Region("right", new Vector3(2.25f, 1.1f, 0));
            Label(r, LL("trust"), T_HEAD, ThemeSecondary(), Vector3.zero);
            float y = -0.18f;
            string[] keys = { "integrity", "provenance", "decision_support", "human_policy" };
            var groups = ShadowAuditWorkspaceModel.BuildTrustStrip(focus);
            for (int i = 0; i < groups.Count; i++)
            {
                Label(r, Cut(LL(keys[i]), 12f), T_BODY, ThemeText(), new Vector3(0, y, 0));
                Label(r, Cut(SV(groups[i].RepresentativeStatus, Zh), 12f), T_BODY, GlyphColor(groups[i].RepresentativeStatus), new Vector3(0, y - 0.10f, 0));
                y -= 0.26f;
            }
        }

        void RebuildRail(StoryScenario sc)
        {
            var r = Region("bottom", new Vector3(-2.4f, -1.6f, 0));
            var items = ShadowAuditWorkspaceModel.BuildRail(_model, sc, _focusEntityId);
            float x = 0f;
            foreach (var it in items)
            {
                var col = GlyphColor(it.Status);
                Quad(r, new Vector3(x, 0, 0),
                    it.IsFirstFailure ? ShadowStatusGlyph.FamilyColor("failure_red", ProfileId)
                    : it.IsDownstream ? ShadowStatusGlyph.FamilyColor("neutral_unknown", ProfileId)
                    : ShadowStatusGlyph.Resolve(it.Status, ProfileId).ColorHex, it.IsCurrent ? 0.15f : 0.09f);
                Label(r, "#" + it.Sequence, it.IsCurrent ? 0.04f : 0.028f, col, new Vector3(x - 0.05f, -0.16f, 0));
                if (it.IsFirstFailure) Label(r, LL("first_short"), T_SMALL, GlyphColor("FIRST_FAILURE"), new Vector3(x - 0.05f, 0.16f, 0));
                else if (it.IsDownstream) Label(r, "↓" + LL("dep_short"), T_SMALL, GlyphColor("AFFECTED_DOWNSTREAM"), new Vector3(x - 0.05f, 0.16f, 0));
                x += 0.62f;
            }
            Label(r, "◀ " + LL("prev") + "   ▶ " + LL("next") + "   ⟳ " + LL("reset") + "   ⌖ " + LL("recenter") + "   [ " + LL("open_2d_audit") + " ]", T_SMALL, ThemeSecondary(), new Vector3(0, -0.36f, 0));
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
        Color GlyphColor(string status) => Hex(ShadowStatusGlyph.Resolve(status, ProfileId).ColorHex);

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
