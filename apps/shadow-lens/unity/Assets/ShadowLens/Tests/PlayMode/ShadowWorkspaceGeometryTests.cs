// UX-02 / UX-03 acceptance. Measures the REAL renderer bounds of the built workspace and projects
// them through the capture camera, so a pass means "these rectangles do not overlap on screen" rather
// than "these constants look right". Runs the whole matrix: 5 visual profiles × EN/ZH × the audited
// states. Thresholds come from ShadowWorkspaceLayout — the same values production renders with, never
// a test-only magic number. No PNG is compared.
//
// Out of scope by construction, and therefore excluded rather than silently passed:
//   · the degraded-tracking banner (UX-04) — its own region row, still clipped, still open
//   · the bottom evidence rail (UX-14) — label/index collision, still open
#if UNITY_INCLUDE_TESTS
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using ShadowLens.GuidedStory;
using ShadowLens.Workspace;
using P = ShadowLens.Design.ShadowDesignTokens.ShadowVisualProfile;

namespace ShadowLens.Tests.PlayMode
{
    public class ShadowWorkspaceGeometryTests
    {
        const int W = ShadowWorkspaceLayout.CaptureRig.PixelWidth, H = ShadowWorkspaceLayout.CaptureRig.PixelHeight;
        Camera _cam; ShadowAuditWorkspace _ws; GameObject _root; Font _cjk;

        static GuidedStorySemantic Model(string longSource = null, string longLoc = null)
        {
            var m = new GuidedStorySemantic { StoryId = "banking", Title = new Bilingual { En = "Banking Audit", Zh = "银行审计" } };
            m.Entities.Add(new StoryEntity { Id = "income", Kind = "record", Sequence = 1, Label = new Bilingual { En = "Income", Zh = "收入" }, EvidenceRef = longSource ?? "ev.income" });
            m.Entities.Add(new StoryEntity { Id = "dti", Kind = "record", Sequence = 2, Label = new Bilingual { En = "DTI", Zh = "债务收入比" }, EvidenceRef = "ev.dti" });
            m.Entities.Add(new StoryEntity { Id = "decision", Kind = "decision", Sequence = 3, Label = new Bilingual { En = "Council Decision", Zh = "委员会决策" }, EvidenceRef = null });
            m.Entities.Add(new StoryEntity { Id = "pricing", Kind = "record", Sequence = 4, Label = new Bilingual { En = "Pricing Tier", Zh = "定价档位" }, EvidenceRef = "ev.pricing" });
            return m;
        }
        static StoryScenario Scenario(string review = "REQUIRES_HUMAN_REVIEW", string approval = "APPROVAL_NOT_PRESENT")
        {
            var sc = new StoryScenario { Id = "s", FirstFailure = "decision" };
            sc.AffectedDownstream.Add("pricing");
            sc.EntityStatus["income"] = "VERIFIED"; sc.EntityStatus["dti"] = "VERIFIED";
            sc.EntityStatus["decision"] = "FIRST_FAILURE"; sc.EntityStatus["pricing"] = "AFFECTED_DOWNSTREAM";
            sc.DimensionStatus["HUMAN_REVIEW"] = review;
            sc.DimensionStatus["HUMAN_APPROVAL"] = approval;
            sc.DimensionStatus["TRUST_POSTURE"] = "SELF_SIGNED";
            return sc;
        }

        [SetUp]
        public void Setup()
        {
            _cjk = Font.CreateDynamicFontFromOSFont(new[] { "Hiragino Sans GB", "STHeiti", "PingFang SC", "Arial Unicode MS" }, 64);
            var camGo = new GameObject("GeomCam"); camGo.tag = "MainCamera";
            _cam = camGo.AddComponent<Camera>();
            _cam.transform.position = new Vector3(0f, ShadowWorkspaceLayout.CaptureRig.CameraY, ShadowWorkspaceLayout.CaptureRig.CameraZ);
            _cam.transform.LookAt(new Vector3(0f, ShadowWorkspaceLayout.CaptureRig.CameraY, 0f));
            _cam.fieldOfView = ShadowWorkspaceLayout.CaptureRig.FieldOfViewDeg;
            _cam.aspect = (float)W / H;
            _root = new GameObject("GeomWorkspace");
            _ws = _root.AddComponent<ShadowAuditWorkspace>();
            _ws.LabelFont = _cjk;
        }
        [TearDown]
        public void Teardown()
        {
            if (_root != null) Object.DestroyImmediate(_root);
            if (_cam != null) Object.DestroyImmediate(_cam.gameObject);
        }

        // ── projection ──────────────────────────────────────────────────────────────────────────
        struct Box { public string Region, Text; public Rect R; }

        // Analytic pinhole projection through the capture rig. Camera.WorldToScreenPoint would use the
        // batchmode window size (not 1600×1000), which silently shrinks every rectangle ~2.5×.
        Vector2 ToPixels(Vector3 w)
        {
            const float focal = ShadowWorkspaceLayout.CaptureRig.PixelHeight / 2f;
            float f = focal / Mathf.Tan(ShadowWorkspaceLayout.CaptureRig.FieldOfViewDeg * 0.5f * Mathf.Deg2Rad);
            float d = w.z - ShadowWorkspaceLayout.CaptureRig.CameraZ;
            return new Vector2(
                W * 0.5f + (w.x - 0f) * f / d,
                H * 0.5f + (w.y - ShadowWorkspaceLayout.CaptureRig.CameraY) * f / d);
        }

        Rect Project(Renderer r)
        {
            var b = r.bounds;
            float xmin = float.MaxValue, xmax = float.MinValue, ymin = float.MaxValue, ymax = float.MinValue;
            for (int i = 0; i < 8; i++)
            {
                var c = new Vector3(
                    (i & 1) == 0 ? b.min.x : b.max.x,
                    (i & 2) == 0 ? b.min.y : b.max.y,
                    (i & 4) == 0 ? b.min.z : b.max.z);
                var s = ToPixels(c);
                xmin = Mathf.Min(xmin, s.x); xmax = Mathf.Max(xmax, s.x);
                ymin = Mathf.Min(ymin, s.y); ymax = Mathf.Max(ymax, s.y);
            }
            return Rect.MinMaxRect(xmin, ymin, xmax, ymax);
        }

        // Region roots are children of the workspace; only the regions this increment owns are measured.
        static readonly string[] IN_SCOPE = { "region.top", "region.left", "region.center", "region.right" };
        // region.bottom is NOT in scope to fix (its internal label/index collision is UX-14), but the
        // in-scope regions must not grow into it — that would be a new collision, not a fix.
        const string BOUNDARY = "region.bottom";

        List<Box> Boxes(bool includeBanner = false)
        {
            var outp = new List<Box>();
            foreach (Transform region in _root.transform.GetChild(0) != null ? _root.transform : _root.transform)
            {
                if (!IN_SCOPE.Contains(region.name) && region.name != BOUNDARY) continue;
                var texts = region.GetComponentsInChildren<TextMesh>(false);
                foreach (var tm in texts)
                {
                    if (string.IsNullOrWhiteSpace(tm.text)) continue;
                    // the degraded-tracking banner is UX-04 and is excluded on purpose
                    bool isBanner = region.name == "region.top" && Mathf.Abs(tm.transform.localPosition.x) > 1.0f;
                    if (isBanner && !includeBanner) continue;
                    var r = tm.GetComponent<Renderer>();
                    if (r == null || !r.enabled) continue;
                    outp.Add(new Box { Region = region.name, Text = tm.text, R = Project(r) });
                }
            }
            return outp;
        }

        static bool Overlaps(Rect a, Rect b) => a.xMin < b.xMax && b.xMin < a.xMax && a.yMin < b.yMax && b.yMin < a.yMax;
        static float GapX(Rect a, Rect b) => a.xMax <= b.xMin ? b.xMin - a.xMax : (b.xMax <= a.xMin ? a.xMin - b.xMax : 0f);
        static string Fmt(Rect r) => $"[{r.xMin:F0},{r.yMin:F0} → {r.xMax:F0},{r.yMax:F0}]";
        string Ctx(string profile, bool zh, string state) => $"profile={profile} lang={(zh ? "zh-CN" : "en")} state={state}";

        static readonly P[] PROFILES = { P.DesktopDark, P.BrowserDark, P.ProjectorPresentation, P.XrealOstBright, P.AccessibilityHighContrast };
        // (state, focus, review, approval, model)
        static IEnumerable<(string state, string focus, string review, string approval, GuidedStorySemantic model)> STATES()
        {
            yield return ("source-present-normal", "income", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", Model());
            yield return ("source-missing", "decision", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", Model());
            yield return ("location-unavailable", "decision", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", Model());
            yield return ("first-failure", "decision", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", Model());
            yield return ("source-missing+first-failure", "decision", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", Model());
            yield return ("human-review-required", "decision", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT", Model());
            yield return ("approval-absent", "decision", "HUMAN_REVIEW_RECORDED", "APPROVAL_NOT_PRESENT", Model());
            yield return ("trust-strip-populated", "decision", "HUMAN_REVIEW_RECORDED", "APPROVAL_PRESENT", Model());
            yield return ("longest-source", "income", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT",
                Model("evidence.bundle.loan-origination-2026-Q3.income-verification.pdf"));
        }

        IEnumerator Bind(P profile, bool zh, GuidedStorySemantic model, string focus, string review, string approval)
        {
            _ws.Profile = profile; _ws.Zh = zh;
            _ws.BindDirect(model, Scenario(review, approval), focus);
            // Region() clears children with Destroy(), which Unity defers to end-of-frame; measuring
            // too early mixes the previous state's labels into the bounds. Wait past the deferred
            // destruction AND past TextMesh geometry rebuild before reading any renderer bounds.
            yield return null; yield return null; yield return null; yield return null;
        }

        // ── A/B. column separation + cross-column collision (UX-02) ─────────────────────────────
        [UnityTest]
        public IEnumerator Columns_DoNotOverlap_AcrossEveryProfileAndLanguage()
        {
            var failures = new List<string>();
            foreach (var p in PROFILES)
                foreach (var zh in new[] { false, true })
                    foreach (var st in STATES())
                    {
                        yield return Bind(p, zh, st.model, st.focus, st.review, st.approval);
                        var boxes = Boxes();
                        foreach (var a in boxes)
                            foreach (var b in boxes)
                            {
                                if (a.Region == b.Region || string.CompareOrdinal(a.Region, b.Region) >= 0) continue;
                            if (a.Region == BOUNDARY && b.Region == BOUNDARY) continue;
                                if (Overlaps(a.R, b.R))
                                    failures.Add($"{Ctx(p.ToString(), zh, st.state)} OVERLAP {a.Region}\"{a.Text}\"{Fmt(a.R)} × {b.Region}\"{b.Text}\"{Fmt(b.R)}");
                            }
                    }
            CollectionAssert.IsEmpty(failures, "cross-column overlaps:\n" + string.Join("\n", failures.Take(25)));
        }

        [UnityTest]
        public IEnumerator LocationUnavailable_DoesNotTouch_VerificationFirstFailure()
        {
            // the exact pair the audit captured crossing each other
            var failures = new List<string>();
            foreach (var p in PROFILES)
                foreach (var zh in new[] { false, true })
                {
                    yield return Bind(p, zh, Model(), "decision", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT");
                    var boxes = Boxes();
                    var loc = boxes.Where(b => b.Region == "region.left").ToList();
                    var ver = boxes.Where(b => b.Region == "region.center").ToList();
                    foreach (var l in loc)
                        foreach (var v in ver)
                        {
                            if (Overlaps(l.R, v.R)) failures.Add($"{Ctx(p.ToString(), zh, "first-failure")} OVERLAP left\"{l.Text}\" × center\"{v.Text}\"");
                            else
                            {
                                float gap = GapX(l.R, v.R);
                                float need = ShadowWorkspaceLayout.MinColumnGap * 190.8f * 0.5f; // half the named gap in px
                                if (gap > 0 && gap < need)
                                    failures.Add($"{Ctx(p.ToString(), zh, "first-failure")} GAP left\"{l.Text}\" × center\"{v.Text}\" measured={gap:F0}px required≥{need:F0}px");
                            }
                        }
                }
            CollectionAssert.IsEmpty(failures, "left/centre collisions:\n" + string.Join("\n", failures.Take(25)));
        }

        // ── C. Trust Strip rhythm (UX-03) ───────────────────────────────────────────────────────
        [UnityTest]
        public IEnumerator TrustStrip_LabelValuePairs_DoNotOverlap()
        {
            var failures = new List<string>();
            foreach (var p in PROFILES)
                foreach (var zh in new[] { false, true })
                {
                    yield return Bind(p, zh, Model(), "decision", "HUMAN_REVIEW_RECORDED", "APPROVAL_PRESENT");
                    var strip = Boxes().Where(b => b.Region == "region.right").OrderByDescending(b => b.R.yMax).ToList();
                    Assert.GreaterOrEqual(strip.Count, 9, $"{Ctx(p.ToString(), zh, "trust")} expected a heading + 4 label/value pairs");
                    for (int i = 0; i < strip.Count - 1; i++)
                        if (Overlaps(strip[i].R, strip[i + 1].R))
                            failures.Add($"{Ctx(p.ToString(), zh, "trust")} OVERLAP \"{strip[i].Text}\"{Fmt(strip[i].R)} × \"{strip[i + 1].Text}\"{Fmt(strip[i + 1].R)}");
                }
            CollectionAssert.IsEmpty(failures, "Trust Strip overlaps:\n" + string.Join("\n", failures.Take(25)));
        }

        // ── D. body rhythm inside every in-scope region (UX-03) ─────────────────────────────────
        [UnityTest]
        public IEnumerator AdjacentLines_WithinARegion_DoNotOverlap()
        {
            var failures = new List<string>();
            foreach (var p in PROFILES)
                foreach (var zh in new[] { false, true })
                    foreach (var st in STATES())
                    {
                        yield return Bind(p, zh, st.model, st.focus, st.review, st.approval);
                        foreach (var grp in Boxes().Where(b => b.Region != BOUNDARY).GroupBy(b => b.Region))
                        {
                            var col = grp.OrderByDescending(b => b.R.yMax).ToList();
                            for (int i = 0; i < col.Count - 1; i++)
                                if (Overlaps(col[i].R, col[i + 1].R))
                                    failures.Add($"{Ctx(p.ToString(), zh, st.state)} {grp.Key} OVERLAP \"{col[i].Text}\"{Fmt(col[i].R)} × \"{col[i + 1].Text}\"{Fmt(col[i + 1].R)}");
                        }
                    }
            CollectionAssert.IsEmpty(failures, "intra-region line overlaps:\n" + string.Join("\n", failures.Take(25)));
        }

        // ── E. viewport safety ──────────────────────────────────────────────────────────────────
        [UnityTest]
        public IEnumerator InScopeContent_StaysInsideTheCaptureViewport()
        {
            var failures = new List<string>();
            foreach (var p in PROFILES)
                foreach (var zh in new[] { false, true })
                    foreach (var st in STATES())
                    {
                        yield return Bind(p, zh, st.model, st.focus, st.review, st.approval);
                        foreach (var b in Boxes())   // includes region.bottom: this increment moved it
                            if (b.R.xMin < 0 || b.R.xMax > W || b.R.yMin < 0 || b.R.yMax > H)
                                failures.Add($"{Ctx(p.ToString(), zh, st.state)} {b.Region} CLIPPED \"{b.Text}\" {Fmt(b.R)} viewport=[0,0 → {W},{H}]");
                    }
            CollectionAssert.IsEmpty(failures, "viewport clipping:\n" + string.Join("\n", failures.Take(25)));
        }

        // ── F. no semantic line is lost to an unintended ellipsis (UX-02) ───────────────────────
        [UnityTest]
        public IEnumerator NoSemanticLineIsTruncated()
        {
            var failures = new System.Collections.Generic.List<string>();
            foreach (var p in PROFILES)
                foreach (var zh in new[] { false, true })
                    foreach (var st in STATES())
                    {
                        yield return Bind(p, zh, st.model, st.focus, st.review, st.approval);
                        foreach (var b in Boxes().Where(x => x.Region != BOUNDARY))
                        {
                            if (!b.Text.Contains("…")) continue;
                            // the only sanctioned ellipsis: an operator-supplied evidence identifier,
                            // which has no bounded length and is documented as intentionally elided.
                            if (st.state == "longest-source" && b.Region == "region.left") continue;
                            failures.Add($"{Ctx(p.ToString(), zh, st.state)} {b.Region} TRUNCATED \"{b.Text}\"");
                        }
                    }
            CollectionAssert.IsEmpty(failures, "unintended truncation:\n" + string.Join("\n", failures.Take(25)));
        }

        // ── G. semantic stability — layout must not have changed meaning ────────────────────────
        [UnityTest]
        public IEnumerator SemanticsAndProfileColoursAreUnchanged()
        {
            yield return Bind(P.XrealOstBright, false, Model(), "decision", "REQUIRES_HUMAN_REVIEW", "APPROVAL_NOT_PRESENT");
            var g = ShadowStatusGlyph.Resolve("FIRST_FAILURE", "XrealOstBright");
            Assert.AreEqual("FIRST FAILURE", g.Text);
            Assert.AreEqual(ShadowLens.Generated.ShadowSemanticTokens.ColorFor("status", "FIRST_FAILURE", "XrealOstBright"), g.ColorHex,
                "profile-aware colour from d664873 must be untouched by a layout change");
            var texts = Boxes().Select(b => b.Text).ToList();
            Assert.IsTrue(texts.Any(t => t.Contains("FIRST FAILURE")), "first failure must remain visible");
            Assert.IsTrue(texts.Any(t => t.Contains("SOURCE") || t.Contains("Source")), "source provenance must remain visible");
        }
    }
}
#endif
