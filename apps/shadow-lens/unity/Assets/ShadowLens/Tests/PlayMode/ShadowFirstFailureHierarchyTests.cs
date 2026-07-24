// UX-07 acceptance: when an audit reaches a first failure, that result must be the primary visual
// conclusion — not the fourth-largest thing on screen behind two unrelated titles.
//
// The HIERARCHY METRIC used here is deliberately narrow: it measures the rendered character size of
// each labelled element and the presence of the named non-typographic signals. It proves the design
// CONTRACT is applied. It does not — and cannot — prove that the result is aesthetically good or that
// it will be salient through a waveguide; that needs the device.
//
// Untouched by construction: UX-12 (Workspace vs Room Flat colour grammar) — this increment changes
// only the Audit Workspace, which is the scene the committed UX-07 names.
#if UNITY_INCLUDE_TESTS
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using ShadowLens.GuidedStory;
using ShadowLens.Workspace;
using L = ShadowLens.Workspace.ShadowWorkspaceLayout;
using P = ShadowLens.Design.ShadowDesignTokens.ShadowVisualProfile;

namespace ShadowLens.Tests.PlayMode
{
    public class ShadowFirstFailureHierarchyTests
    {
        const int W = L.CaptureRig.PixelWidth, H = L.CaptureRig.PixelHeight;
        ShadowAuditWorkspace _ws; GameObject _root; Font _cjk;

        static GuidedStorySemantic Model()
        {
            var m = new GuidedStorySemantic { StoryId = "banking", Title = new Bilingual { En = "Banking Audit", Zh = "银行审计" } };
            m.Entities.Add(new StoryEntity { Id = "income", Kind = "record", Sequence = 1, Label = new Bilingual { En = "Income", Zh = "收入" }, EvidenceRef = "ev.income" });
            m.Entities.Add(new StoryEntity { Id = "decision", Kind = "decision", Sequence = 2, Label = new Bilingual { En = "Council Decision", Zh = "委员会决策" }, EvidenceRef = null });
            m.Entities.Add(new StoryEntity { Id = "pricing", Kind = "record", Sequence = 3, Label = new Bilingual { En = "Pricing Tier", Zh = "定价档位" }, EvidenceRef = "ev.pricing" });
            return m;
        }
        // firstFailure == null → a clean audit with no failure at all
        static StoryScenario Scenario(string firstFailure, string review, string approval, string incomeStatus = "VERIFIED")
        {
            var sc = new StoryScenario { Id = "s", FirstFailure = firstFailure };
            sc.EntityStatus["income"] = incomeStatus;
            sc.EntityStatus["decision"] = firstFailure == "decision" ? "FIRST_FAILURE" : "VERIFIED";
            if (firstFailure == "decision") { sc.AffectedDownstream.Add("pricing"); sc.EntityStatus["pricing"] = "AFFECTED_DOWNSTREAM"; }
            else sc.EntityStatus["pricing"] = "VERIFIED";
            sc.DimensionStatus["HUMAN_REVIEW"] = review;
            sc.DimensionStatus["HUMAN_APPROVAL"] = approval;
            sc.DimensionStatus["TRUST_POSTURE"] = "SELF_SIGNED";
            return sc;
        }

        [SetUp]
        public void Setup()
        {
            _cjk = Font.CreateDynamicFontFromOSFont(new[] { "Hiragino Sans GB", "STHeiti", "PingFang SC", "Arial Unicode MS" }, 64);
            _root = new GameObject("HierarchyWorkspace");
            _ws = _root.AddComponent<ShadowAuditWorkspace>();
            _ws.LabelFont = _cjk;
        }
        [TearDown]
        public void Teardown() { if (_root != null) Object.DestroyImmediate(_root); }

        Vector2 ToPixels(Vector3 w)
        {
            float f = (H / 2f) / Mathf.Tan(L.CaptureRig.FieldOfViewDeg * 0.5f * Mathf.Deg2Rad);
            float d = w.z - L.CaptureRig.CameraZ;
            return new Vector2(W * 0.5f + w.x * f / d, H * 0.5f + (w.y - L.CaptureRig.CameraY) * f / d);
        }
        Rect Project(Renderer r)
        {
            var b = r.bounds;
            float x0 = float.MaxValue, x1 = float.MinValue, y0 = float.MaxValue, y1 = float.MinValue;
            for (int i = 0; i < 8; i++)
            {
                var c = new Vector3((i & 1) == 0 ? b.min.x : b.max.x, (i & 2) == 0 ? b.min.y : b.max.y, (i & 4) == 0 ? b.min.z : b.max.z);
                var s = ToPixels(c);
                x0 = Mathf.Min(x0, s.x); x1 = Mathf.Max(x1, s.x); y0 = Mathf.Min(y0, s.y); y1 = Mathf.Max(y1, s.y);
            }
            return Rect.MinMaxRect(x0, y0, x1, y1);
        }
        static bool Overlaps(Rect a, Rect b) => a.xMin < b.xMax && b.xMin < a.xMax && a.yMin < b.yMax && b.yMin < a.yMax;
        static string Fmt(Rect r) => $"[{r.xMin:F0},{r.yMin:F0} → {r.xMax:F0},{r.yMax:F0}]";

        struct Lbl { public string Region, Text; public float Size; public Rect R; }
        List<Lbl> Labels()
        {
            var o = new List<Lbl>();
            foreach (Transform reg in _root.transform)
                foreach (var tm in reg.GetComponentsInChildren<TextMesh>(false))
                {
                    if (string.IsNullOrWhiteSpace(tm.text)) continue;
                    var r = tm.GetComponent<Renderer>(); if (r == null || !r.enabled) continue;
                    o.Add(new Lbl { Region = reg.name, Text = tm.text, Size = tm.characterSize, R = Project(r) });
                }
            return o;
        }
        bool HasConclusionRule() =>
            _root.GetComponentsInChildren<Transform>(true).Any(t => t.name == "conclusion.rule");
        Lbl Conclusion() => Labels().First(l => l.Region == "region.center" && l.Text.Contains("◆"));
        bool AnyConclusion() => Labels().Any(l => l.Region == "region.center" && l.Text.Contains("◆"));

        static readonly P[] PROFILES = { P.DesktopDark, P.BrowserDark, P.ProjectorPresentation, P.XrealOstBright, P.AccessibilityHighContrast };
        string Ctx(P p, bool zh, string st) => $"profile={p} lang={(zh ? "zh-CN" : "en")} state={st}";

        // (name, firstFailure, focus, review, approval, incomeStatus, tracking)
        static IEnumerable<(string n, string ff, string focus, string rev, string app, string inc, string trk)> FAILURE_STATES()
        {
            yield return ("first-failure", "decision", "decision", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", "VERIFIED", "TRACKED_3DOF");
            yield return ("first-failure+downstream", "decision", "decision", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", "VERIFIED", "TRACKED_3DOF");
            yield return ("first-failure+human-review", "decision", "decision", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", "VERIFIED", "TRACKED_3DOF");
            yield return ("first-failure+approval-absent", "decision", "decision", "HUMAN_REVIEW_RECORDED", "APPROVAL_NOT_PRESENT", "VERIFIED", "TRACKED_3DOF");
            yield return ("first-failure+source-missing", "decision", "decision", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", "NOT_PRESENT", "TRACKED_3DOF");
            yield return ("first-failure+tracking-degraded", "decision", "decision", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", "VERIFIED", "LOST");
        }
        static IEnumerable<(string n, string ff, string focus, string rev, string app, string inc, string trk)> CALM_STATES()
        {
            yield return ("normal-verified", null, "income", "HUMAN_REVIEW_RECORDED", "APPROVAL_PRESENT", "VERIFIED", "TRACKED_3DOF");
            yield return ("unknown", null, "income", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", "NOT_EVALUATED", "TRACKED_3DOF");
            yield return ("source-missing-no-failure", null, "income", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", "NOT_PRESENT", "TRACKED_3DOF");
            yield return ("scanning", null, "income", "HUMAN_REVIEW_RECORDED", "APPROVAL_PRESENT", "VERIFIED", "SCANNING");
            yield return ("recovering", null, "income", "HUMAN_REVIEW_RECORDED", "APPROVAL_PRESENT", "VERIFIED", "RECOVERING");
        }

        IEnumerator Bind(P p, bool zh, (string n, string ff, string focus, string rev, string app, string inc, string trk) st)
        {
            _ws.Profile = p; _ws.Zh = zh; _ws.Tracking = st.trk;
            _ws.BindDirect(Model(), Scenario(st.ff, st.rev, st.app, st.inc), st.focus);
            yield return null; yield return null; yield return null; yield return null;
        }

        // ── A. state-driven roles ───────────────────────────────────────────────────────────────
        [UnityTest]
        public IEnumerator FirstFailureState_AppliesThePrimaryConclusionRole()
        {
            var fails = new List<string>();
            foreach (var p in PROFILES)
                foreach (var zh in new[] { false, true })
                    foreach (var st in FAILURE_STATES())
                    {
                        yield return Bind(p, zh, st);
                        if (!AnyConclusion()) { fails.Add($"{Ctx(p, zh, st.n)} no conclusion element"); continue; }
                        var c = Conclusion();
                        if (!Mathf.Approximately(c.Size, L.ConclusionSize))
                            fails.Add($"{Ctx(p, zh, st.n)} conclusion size {c.Size} != {L.ConclusionSize}");
                        if (!HasConclusionRule()) fails.Add($"{Ctx(p, zh, st.n)} accent rule missing");
                    }
            CollectionAssert.IsEmpty(fails, "primary role not applied:\n" + string.Join("\n", fails.Take(20)));
        }

        [UnityTest]
        public IEnumerator CalmStates_DoNotInheritFailureEmphasis()
        {
            var fails = new List<string>();
            foreach (var p in PROFILES)
                foreach (var zh in new[] { false, true })
                    foreach (var st in CALM_STATES())
                    {
                        yield return Bind(p, zh, st);
                        if (AnyConclusion()) fails.Add($"{Ctx(p, zh, st.n)} FALSE conclusion element rendered");
                        if (HasConclusionRule()) fails.Add($"{Ctx(p, zh, st.n)} FALSE accent rule rendered");
                        // titles keep their full weight when there is no failure to defer to
                        var titles = Labels().Where(l => Mathf.Approximately(l.Size, L.TitleSize)).ToList();
                        if (titles.Count < 2) fails.Add($"{Ctx(p, zh, st.n)} expected both titles at TitleSize {L.TitleSize}, found {titles.Count}");
                        if (Labels().Any(l => Mathf.Approximately(l.Size, L.ConclusionSize)))
                            fails.Add($"{Ctx(p, zh, st.n)} something is rendered at ConclusionSize without a failure");
                    }
            CollectionAssert.IsEmpty(fails, "calm state inherited failure emphasis:\n" + string.Join("\n", fails.Take(20)));
        }

        // ── B/C. multi-signal + relative weight ─────────────────────────────────────────────────
        [UnityTest]
        public IEnumerator Conclusion_UsesAtLeastTwoNonColourSignals_AndDominatesByTheNamedRatio()
        {
            var fails = new List<string>();
            foreach (var p in PROFILES)
                foreach (var zh in new[] { false, true })
                    foreach (var st in FAILURE_STATES())
                    {
                        yield return Bind(p, zh, st);
                        var all = Labels();
                        var c = Conclusion();
                        var signals = new List<string>();
                        // 1 typography: strictly the largest label on screen
                        float competitor = all.Where(l => l.Text != c.Text).Max(l => l.Size);
                        if (c.Size > competitor) signals.Add("typography");
                        float ratio = c.Size / competitor;
                        if (ratio < L.MinConclusionDominanceRatio)
                            fails.Add($"{Ctx(p, zh, st.n)} dominance ratio {ratio:F3} < required {L.MinConclusionDominanceRatio} " +
                                      $"(conclusion {c.Size}, largest competitor {competitor})");
                        // 2 rule: a border/surface signal
                        if (HasConclusionRule()) signals.Add("accent-rule");
                        // 3 padding: measurable separation from the row above
                        var above = all.Where(l => l.Region == "region.center" && l.R.yMin >= c.R.yMax - 0.5f)
                                       .OrderBy(l => l.R.yMin).FirstOrDefault();
                        if (above.Text != null && above.R.yMin - c.R.yMax >= L.ConclusionPadAbove * 190.8f * 0.5f) signals.Add("padding");
                        if (signals.Count < 2)
                            fails.Add($"{Ctx(p, zh, st.n)} only {signals.Count} non-colour signal(s): [{string.Join(",", signals)}]");
                    }
            CollectionAssert.IsEmpty(fails, "hierarchy signals insufficient:\n" + string.Join("\n", fails.Take(20)));
        }

        [UnityTest]
        public IEnumerator SupportingContext_StaysVisibleAndSubordinate()
        {
            var fails = new List<string>();
            foreach (var p in PROFILES)
                foreach (var zh in new[] { false, true })
                {
                    yield return Bind(p, zh, FAILURE_STATES().First());
                    var all = Labels();
                    var c = Conclusion();
                    // nothing is hidden: every supporting region still renders
                    foreach (var reg in new[] { "region.top", "region.left", "region.center", "region.right", "region.bottom" })
                        if (!all.Any(l => l.Region == reg)) fails.Add($"{Ctx(p, zh, "first-failure")} region {reg} disappeared");
                    // the system/device context must not out-weigh the conclusion
                    foreach (var l in all.Where(l => l.Region == "region.top"))
                        if (l.Size > c.Size) fails.Add($"{Ctx(p, zh, "first-failure")} system context \"{l.Text}\" ({l.Size}) out-weighs the conclusion ({c.Size})");
                    // supporting evidence and trust remain readable, i.e. not shrunk below body size
                    foreach (var l in all.Where(l => l.Region == "region.left" || l.Region == "region.right"))
                        if (l.Size < L.BodySize - 0.0001f) fails.Add($"{Ctx(p, zh, "first-failure")} supporting \"{l.Text}\" shrank to {l.Size}");
                }
            CollectionAssert.IsEmpty(fails, "supporting context regression:\n" + string.Join("\n", fails.Take(20)));
        }

        // ── D. geometry ─────────────────────────────────────────────────────────────────────────
        [UnityTest]
        public IEnumerator Conclusion_StaysInsideItsRegionWithNoOverlapOrClipping()
        {
            float safeR = ToPixels(new Vector3(L.ViewportSafeX, 0, 0)).x, safeL = ToPixels(new Vector3(-L.ViewportSafeX, 0, 0)).x;
            var fails = new List<string>();
            foreach (var p in PROFILES)
                foreach (var zh in new[] { false, true })
                    foreach (var st in FAILURE_STATES())
                    {
                        yield return Bind(p, zh, st);
                        var all = Labels();
                        var c = Conclusion();
                        if (c.Text.Contains("…")) fails.Add($"{Ctx(p, zh, st.n)} conclusion TRUNCATED \"{c.Text}\"");
                        if (c.Text.Contains("\n")) fails.Add($"{Ctx(p, zh, st.n)} conclusion WRAPPED \"{c.Text.Replace("\n", " / ")}\"");
                        if (c.R.xMax > safeR || c.R.xMin < safeL || c.R.yMin < 0 || c.R.yMax > H)
                            fails.Add($"{Ctx(p, zh, st.n)} conclusion CLIPPED {Fmt(c.R)} safeX=[{safeL:F0},{safeR:F0}]");
                        foreach (var o in all.Where(l => l.Text != c.Text))
                            if (Overlaps(c.R, o.R))
                                fails.Add($"{Ctx(p, zh, st.n)} conclusion OVERLAPS {o.Region}\"{o.Text.Replace("\n", " / ")}\"{Fmt(o.R)}");
                    }
            CollectionAssert.IsEmpty(fails, "conclusion geometry:\n" + string.Join("\n", fails.Take(20)));
        }

        // ── E/F. accessibility + semantic stability ─────────────────────────────────────────────
        [UnityTest]
        public IEnumerator HierarchyDoesNotDependOnColour_AndSemanticsAreUnchanged()
        {
            // The conclusion keeps the SAME colour family as before; the hierarchy is carried by size,
            // rule and padding. Strip colour and it is still the largest element with a rule under it.
            yield return Bind(P.AccessibilityHighContrast, false, FAILURE_STATES().First());
            var c = Conclusion();
            Assert.AreEqual(L.ConclusionSize, c.Size, 0.0001f);
            Assert.IsTrue(HasConclusionRule());
            Assert.IsTrue(c.Text.Contains("FIRST FAILURE"), "conclusion wording must not change");

            // status identity, colour family and profile resolution are untouched (d664873)
            var g = ShadowStatusGlyph.Resolve("FIRST_FAILURE", "AccessibilityHighContrast");
            Assert.AreEqual("FIRST FAILURE", g.Text);
            Assert.AreEqual(ShadowLens.Generated.ShadowSemanticTokens.ColorFor("status", "FIRST_FAILURE", "AccessibilityHighContrast"), g.ColorHex);
            Assert.AreEqual("首个失败", ShadowStatusGlyph.Resolve("FIRST_FAILURE", "DesktopDark").TextZh);

            // d7feb01 layout + 01864b4 banner contract untouched
            Assert.AreEqual(2.58f, L.LeftWidth, 0.001f);
            Assert.AreEqual(3.18f, L.CenterWidth, 0.001f);
            Assert.AreEqual(1.84f, L.RightWidth, 0.001f);
            Assert.AreEqual(-1.98f, L.BottomY, 0.001f);
            Assert.AreEqual(0.1962f, L.BodyRowStep, 0.0005f);
            Assert.AreEqual(3, L.BannerMaxLines);
            Assert.AreEqual(4.20f, L.BannerLocalX, 0.001f);

            // Chinese carries the same hierarchy roles
            yield return Bind(P.DesktopDark, true, FAILURE_STATES().First());
            var cz = Conclusion();
            Assert.AreEqual(L.ConclusionSize, cz.Size, 0.0001f);
            Assert.IsTrue(cz.Text.Contains("首个失败"), "Chinese conclusion wording must not change");
            Assert.IsTrue(HasConclusionRule());
        }
    }
}
#endif
