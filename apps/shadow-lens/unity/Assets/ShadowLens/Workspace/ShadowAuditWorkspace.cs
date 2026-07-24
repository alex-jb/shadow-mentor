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

        // Type scale and every column/row metric come from ShadowWorkspaceLayout — the single
        // production layout definition the geometry tests also read (UX-02/UX-03).
        const float T_TITLE = ShadowWorkspaceLayout.TitleSize, T_HEAD = ShadowWorkspaceLayout.HeadSize,
                    T_LABEL = ShadowWorkspaceLayout.LabelSize, T_BODY = ShadowWorkspaceLayout.BodySize,
                    T_SMALL = ShadowWorkspaceLayout.SmallSize;
        static string Cut(string s, float em) => ShadowLabelMetrics.TruncateWithAffordance(s ?? "", em);
        static string Wrap(string s, float em, int lines = 2) => ShadowLabelMetrics.WrapToWidth(s ?? "", em, lines);

        static int Lines(string s) => string.IsNullOrEmpty(s) ? 1 : s.Split('\n').Length;
        string LL(string key) => ShadowWorkspaceLabels.Get(key, Zh);
        // The active profile as the token layer names it. Every status colour in this component resolves
        // through it — never through the DesktopDark default (UX-01).
        string ProfileId => Profile.ToString();
        static string SV(string status, bool zh) { var g = ShadowStatusGlyph.Resolve(status); return zh ? g.TextZh : g.Text; }

        void RebuildHeader(CurrentFocusVM focus)
        {
            var r = Region("top", new Vector3(ShadowWorkspaceLayout.TopX, ShadowWorkspaceLayout.TopY, 0));
            // UX-07: the story name is identity, not a conclusion. While the focused entity IS the
            // first failure it steps down so it cannot out-weigh the audit result. Wording unchanged.
            float titleSize = ShadowWorkspaceLayout.TitleSizeFor(focus.IsFirstFailure);
            Label(r, Cut(_model?.Title?.Pick(Zh) ?? "Shadow Audit", ShadowWorkspaceLayout.WorldToEm(ShadowWorkspaceLayout.TopWidth, titleSize)), titleSize, ThemeText(), Vector3.zero);
            // same derived rhythm as the columns — the title line box is 0.32 world units, so the old
            // 0.30 step could not clear it.
            float ty = -(ShadowWorkspaceLayout.LineHeight(titleSize) + ShadowWorkspaceLayout.MinRowGap);
            Label(r, LL("tracking") + ": " + (ShadowWorkspaceLabels.Has(Tracking) ? LL(Tracking) : Tracking), T_HEAD, ThemeText(), new Vector3(0, ty, 0));
            ty -= ShadowWorkspaceLayout.LineHeight(T_HEAD) + ShadowWorkspaceLayout.MinRowGap;
            Label(r, LL("simulated"), T_SMALL, Hex(ShadowStatusGlyph.DisclaimerColor(ProfileId)), new Vector3(0, ty, 0));
            // UX-04: the explanatory degradation banner now renders inside an explicit bounded region
            // (ShadowWorkspaceLayout.Banner*) and wraps rather than running off the right edge. Copy,
            // colour family and the short tracking header above are unchanged.
            if (ShadowTrackingBanner.IsDegraded(Tracking) || Tracking == "SCANNING")
                Label(r, ShadowLabelMetrics.WrapBlock(ShadowTrackingBanner.Copy(Tracking, Zh),
                          ShadowWorkspaceLayout.BannerEm, ShadowWorkspaceLayout.BannerMaxLines),
                      T_BODY, Hex(ShadowStatusGlyph.FamilyColor("warning_amber", ProfileId)),
                      new Vector3(ShadowWorkspaceLayout.BannerLocalX, ShadowWorkspaceLayout.BannerLocalY, 0));
        }

        void RebuildSource()
        {
            var r = Region("left", new Vector3(ShadowWorkspaceLayout.LeftX, ShadowWorkspaceLayout.ColumnY, 0));
            var src = ShadowAuditWorkspaceModel.BuildSource(_model?.EntityById(_focusEntityId));
            var name = src.Resolution == "PRESENT" ? src.SourceName : LL("source_not_present");
            var loc = src.LocationAvailable ? src.Location : LL("location_not_available");
            float ly = 0f;
            Label(r, LL("source"), T_HEAD, ThemeSecondary(), new Vector3(0, ly, 0));
            ly -= ShadowWorkspaceLayout.LabelRowStep;
            // the source name may wrap rather than cross into the centre column (UX-02)
            Label(r, Wrap(name, ShadowWorkspaceLayout.LeftLabelEm), T_LABEL, ThemeText(), new Vector3(0, ly, 0));
            ly -= ShadowWorkspaceLayout.BlockStep(T_LABEL, Lines(Wrap(name, ShadowWorkspaceLayout.LeftLabelEm)));
            Label(r, Wrap(LL("loc") + ": " + loc, ShadowWorkspaceLayout.LeftBodyEm), T_BODY, ThemeSecondary(), new Vector3(0, ly, 0));
            ly -= ShadowWorkspaceLayout.BlockStep(T_BODY, Lines(Wrap(LL("loc") + ": " + loc, ShadowWorkspaceLayout.LeftBodyEm)));
            Label(r, Cut(LL("resolution") + ": " + SV(src.Resolution == "PRESENT" ? "VERIFIED" : "NOT_PRESENT", Zh), ShadowWorkspaceLayout.LeftBodyEm), T_BODY, GlyphColor(src.Resolution == "PRESENT" ? "VERIFIED" : "NOT_PRESENT"), new Vector3(0, ly, 0));
            ly -= ShadowWorkspaceLayout.BodyRowStep;
            Label(r, Cut(LL("ocr") + ": " + SV("NOT_EVALUATED", Zh), ShadowWorkspaceLayout.LeftBodyEm), T_BODY, GlyphColor("NOT_EVALUATED"), new Vector3(0, ly, 0));
        }

        void RebuildFocus(CurrentFocusVM focus)
        {
            var r = Region("center", new Vector3(ShadowWorkspaceLayout.CenterX, ShadowWorkspaceLayout.ColumnY, 0.05f));
            // UX-07: while the first failure is the conclusion the entity title becomes SECONDARY
            // context. It stays fully readable, keeps its wording, and simply stops competing.
            float ctSize = ShadowWorkspaceLayout.TitleSizeFor(focus.IsFirstFailure);
            string ftitle = Wrap(focus.Title, ShadowWorkspaceLayout.WorldToEm(ShadowWorkspaceLayout.CenterWidth, ctSize));
            Label(r, ftitle, ctSize, ThemeText(), Vector3.zero);
            float ty0 = -ShadowWorkspaceLayout.BlockStep(ctSize, Lines(ftitle));
            Label(r, Cut(LL("role") + ": " + focus.Role, ShadowWorkspaceLayout.CenterBodyEm), T_SMALL, ThemeSecondary(), new Vector3(0, ty0, 0));
            float y = ty0 - ShadowWorkspaceLayout.BodyRowStep;
            foreach (var f in focus.Fields)
            {
                var g = ShadowStatusGlyph.Resolve(f.Status, ProfileId);
                string val = f.Key == "downstream" ? f.Value : SV(f.Status, Zh);
                Label(r, Cut(LL(f.Key) + ": " + val, ShadowWorkspaceLayout.CenterBodyEm), T_BODY, Hex(g.ColorHex), new Vector3(0, y, 0));
                y -= ShadowWorkspaceLayout.BodyRowStep;
            }
            if (focus.IsFirstFailure)
            {
                // PRIMARY_AUDIT_CONCLUSION — the only element rendered at ConclusionSize, separated by
                // its own padding and underlined by an accent rule. Text and colour family unchanged.
                y -= ShadowWorkspaceLayout.ConclusionPadAbove;
                Label(r, Cut("◆ " + LL("first_failure"), ShadowWorkspaceLayout.ConclusionEm),
                      ShadowWorkspaceLayout.ConclusionSize, GlyphColor("FIRST_FAILURE"), new Vector3(0, y, 0));
                y -= ShadowWorkspaceLayout.LineHeight(ShadowWorkspaceLayout.ConclusionSize) + ShadowWorkspaceLayout.ConclusionRuleGap;
                ConclusionRule(r, new Vector3(0, y, 0));
                y -= ShadowWorkspaceLayout.ConclusionRuleHeight + ShadowWorkspaceLayout.ConclusionPadBelow;
            }
            // the next-action hint wraps inside the centre column instead of running into the Trust
            // Strip; the vertical room it needs is the capacity recorded as UX-08 (which stays open).
            string next = Wrap("▶ " + LocalNextAction(focus), ShadowWorkspaceLayout.CenterBodyEm);
            Label(r, next, T_BODY, GlyphColor("APPROVAL_PRESENT"), new Vector3(0, y, 0));
            y -= ShadowWorkspaceLayout.BlockStep(T_BODY, Lines(next));
            Label(r, Cut("[ " + LL("open_2d_audit") + " ]", ShadowWorkspaceLayout.CenterBodyEm), T_BODY, ThemeText(), new Vector3(0, y, 0));
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
            var r = Region("right", new Vector3(ShadowWorkspaceLayout.RightX, ShadowWorkspaceLayout.ColumnY, 0));
            Label(r, LL("trust"), T_HEAD, ThemeSecondary(), Vector3.zero);
            float y = -ShadowWorkspaceLayout.LabelRowStep;
            string[] keys = { "integrity", "provenance", "decision_support", "human_policy" };
            var groups = ShadowAuditWorkspaceModel.BuildTrustStrip(focus);
            for (int i = 0; i < groups.Count; i++)
            {
                Label(r, Cut(LL(keys[i]), ShadowWorkspaceLayout.RightBodyEm), T_BODY, ThemeText(), new Vector3(0, y, 0));
                Label(r, Cut(SV(groups[i].RepresentativeStatus, Zh), ShadowWorkspaceLayout.RightBodyEm), T_BODY, GlyphColor(groups[i].RepresentativeStatus), new Vector3(0, y - ShadowWorkspaceLayout.TrustPairStep, 0));
                y -= ShadowWorkspaceLayout.TrustGroupStep;
            }
        }

        void RebuildRail(StoryScenario sc)
        {
            var r = Region("bottom", new Vector3(ShadowWorkspaceLayout.BottomX, ShadowWorkspaceLayout.BottomY, 0));
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

        // UX-07 accent rule under the primary conclusion — a border/surface signal, not colour alone.
        void ConclusionRule(GameObject parent, Vector3 local)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Quad);
            go.name = "conclusion.rule";
            Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent.transform, false);
            go.transform.localScale = new Vector3(ShadowWorkspaceLayout.ConclusionRuleWidth, ShadowWorkspaceLayout.ConclusionRuleHeight, 1f);
            // Quad is centre-pivoted; the region anchors labels at their upper-left, so offset by half.
            go.transform.localPosition = local + new Vector3(ShadowWorkspaceLayout.ConclusionRuleWidth * 0.5f,
                                                            -ShadowWorkspaceLayout.ConclusionRuleHeight * 0.5f, 0f);
            go.GetComponent<Renderer>().sharedMaterial = SharedMat(ShadowStatusGlyph.FamilyColor("failure_red", ProfileId));
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
