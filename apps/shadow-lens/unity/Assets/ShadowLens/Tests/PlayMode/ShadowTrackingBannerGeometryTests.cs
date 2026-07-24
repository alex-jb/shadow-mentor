// UX-04 acceptance: the degraded-tracking banner must stay inside the viewport-safe region with its
// meaning intact. Uses the same deterministic projection d7feb01 established — an analytic pinhole
// through the capture rig, never Camera.WorldToScreenPoint, which in batchmode projects into the
// actual window size and would pass on rectangles ~2.5× too small.
//
// Thresholds come from ShadowWorkspaceLayout.Banner* — the same values production renders with.
// Out of scope and untouched: UX-14 (evidence guide internals), UX-08 (unused capacity as a goal).
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
    public class ShadowTrackingBannerGeometryTests
    {
        const int W = ShadowWorkspaceLayout.CaptureRig.PixelWidth, H = ShadowWorkspaceLayout.CaptureRig.PixelHeight;
        ShadowAuditWorkspace _ws; GameObject _root; Font _cjk;

        static GuidedStorySemantic Model()
        {
            var m = new GuidedStorySemantic { StoryId = "banking", Title = new Bilingual { En = "Banking Audit", Zh = "银行审计" } };
            m.Entities.Add(new StoryEntity { Id = "income", Kind = "record", Sequence = 1, Label = new Bilingual { En = "Income", Zh = "收入" }, EvidenceRef = "ev.income" });
            m.Entities.Add(new StoryEntity { Id = "decision", Kind = "decision", Sequence = 2, Label = new Bilingual { En = "Council Decision", Zh = "委员会决策" }, EvidenceRef = null });
            m.Entities.Add(new StoryEntity { Id = "pricing", Kind = "record", Sequence = 3, Label = new Bilingual { En = "Pricing Tier", Zh = "定价档位" }, EvidenceRef = "ev.pricing" });
            return m;
        }
        static StoryScenario Scenario()
        {
            var sc = new StoryScenario { Id = "s", FirstFailure = "decision" };
            sc.AffectedDownstream.Add("pricing");
            sc.EntityStatus["income"] = "VERIFIED"; sc.EntityStatus["decision"] = "FIRST_FAILURE";
            sc.EntityStatus["pricing"] = "AFFECTED_DOWNSTREAM";
            sc.DimensionStatus["HUMAN_REVIEW"] = "REQUIRES_HUMAN_REVIEW";
            sc.DimensionStatus["HUMAN_APPROVAL"] = "APPROVAL_NOT_PRESENT";
            sc.DimensionStatus["TRUST_POSTURE"] = "SELF_SIGNED";
            return sc;
        }

        [SetUp]
        public void Setup()
        {
            _cjk = Font.CreateDynamicFontFromOSFont(new[] { "Hiragino Sans GB", "STHeiti", "PingFang SC", "Arial Unicode MS" }, 64);
            _root = new GameObject("BannerWorkspace");
            _ws = _root.AddComponent<ShadowAuditWorkspace>();
            _ws.LabelFont = _cjk;
        }
        [TearDown]
        public void Teardown() { if (_root != null) Object.DestroyImmediate(_root); }

        Vector2 ToPixels(Vector3 w)
        {
            float f = (H / 2f) / Mathf.Tan(ShadowWorkspaceLayout.CaptureRig.FieldOfViewDeg * 0.5f * Mathf.Deg2Rad);
            float d = w.z - ShadowWorkspaceLayout.CaptureRig.CameraZ;
            return new Vector2(W * 0.5f + w.x * f / d, H * 0.5f + (w.y - ShadowWorkspaceLayout.CaptureRig.CameraY) * f / d);
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

        struct Item { public string Region, Text; public Rect R; public bool IsBanner; }

        List<Item> Items()
        {
            var outp = new List<Item>();
            foreach (Transform region in _root.transform)
                foreach (var tm in region.GetComponentsInChildren<TextMesh>(false))
                {
                    if (string.IsNullOrWhiteSpace(tm.text)) continue;
                    var r = tm.GetComponent<Renderer>(); if (r == null || !r.enabled) continue;
                    bool banner = region.name == "region.top" &&
                                  Mathf.Abs(tm.transform.localPosition.x - ShadowWorkspaceLayout.BannerLocalX) < 0.001f;
                    outp.Add(new Item { Region = region.name, Text = tm.text, R = Project(r), IsBanner = banner });
                }
            return outp;
        }

        // every committed tracking state; the banner renders for the degraded ones and SCANNING
        static readonly string[] STATES = { "INITIALIZING", "SCANNING", "TRACKED_3DOF", "TRACKED_6DOF", "LIMITED", "LOST", "RECOVERING", "UNKNOWN_STATE" };
        static readonly P[] PROFILES = { P.DesktopDark, P.BrowserDark, P.ProjectorPresentation, P.XrealOstBright, P.AccessibilityHighContrast };
        static bool ShowsBanner(string t) => ShadowTrackingBanner.IsDegraded(t) || t == "SCANNING";
        string Ctx(P p, bool zh, string st) => $"profile={p} lang={(zh ? "zh-CN" : "en")} tracking={st}";

        IEnumerator Bind(P p, bool zh, string tracking)
        {
            _ws.Profile = p; _ws.Zh = zh; _ws.Tracking = tracking;
            _ws.BindDirect(Model(), Scenario(), "decision");
            yield return null; yield return null; yield return null; yield return null;
        }

        // ── A. viewport containment + margins ───────────────────────────────────────────────────
        [UnityTest]
        public IEnumerator Banner_StaysInsideTheSafeRegion()
        {
            float safeRightPx = ToPixels(new Vector3(ShadowWorkspaceLayout.ViewportSafeX, 0, 0)).x;
            float safeLeftPx = ToPixels(new Vector3(-ShadowWorkspaceLayout.ViewportSafeX, 0, 0)).x;
            var fails = new List<string>();
            foreach (var p in PROFILES)
                foreach (var zh in new[] { false, true })
                    foreach (var st in STATES.Where(ShowsBanner))
                    {
                        yield return Bind(p, zh, st);
                        var b = Items().FirstOrDefault(i => i.IsBanner);
                        Assert.IsNotNull(b.Text, $"{Ctx(p, zh, st)} banner missing");
                        if (b.R.xMax > safeRightPx || b.R.xMin < safeLeftPx || b.R.yMax > H || b.R.yMin < 0)
                            fails.Add($"{Ctx(p, zh, st)} OUTSIDE SAFE rect={Fmt(b.R)} safeX=[{safeLeftPx:F0},{safeRightPx:F0}] viewportY=[0,{H}] lines={b.Text.Split('\n').Length} text=\"{b.Text.Replace("\n", " / ")}\"");
                    }
            CollectionAssert.IsEmpty(fails, "banner outside the safe region:\n" + string.Join("\n", fails));
        }

        // ── B. semantic completeness ────────────────────────────────────────────────────────────
        [UnityTest]
        public IEnumerator Banner_IsNeverTruncated_AndKeepsStateAndConsequence()
        {
            var fails = new List<string>();
            foreach (var p in PROFILES)
                foreach (var zh in new[] { false, true })
                    foreach (var st in STATES.Where(ShowsBanner))
                    {
                        yield return Bind(p, zh, st);
                        var b = Items().First(i => i.IsBanner);
                        string shown = b.Text.Replace("\n", " ");
                        // Chinese has no spaces, so a legitimate wrap lands mid-phrase. Completeness is
                        // therefore compared with ALL line breaks removed: the meaning must survive the
                        // layout, not the layout survive the meaning.
                        string joined = b.Text.Replace("\n", "");
                        string source = ShadowTrackingBanner.Copy(st, zh).Replace("\n", "");
                        if (b.Text.Contains("…"))
                            fails.Add($"{Ctx(p, zh, st)} TRUNCATED \"{shown}\"");
                        if (joined != source)
                            fails.Add($"{Ctx(p, zh, st)} INCOMPLETE rendered=\"{joined}\" committed=\"{source}\"");
                        // no line may begin with closing punctuation left stranded by the wrap
                        foreach (var line in b.Text.Split('\n'))
                            if (line.Length > 0 && "，。；：、！？,.;:!?)]}\u201d\u2019".IndexOf(line[0]) >= 0)
                                fails.Add($"{Ctx(p, zh, st)} STRANDED PUNCTUATION at a line start: \"{line}\"");
                    }
            CollectionAssert.IsEmpty(fails, "banner semantics lost:\n" + string.Join("\n", fails.Take(20)));
        }

        // ── C. neighbour separation ─────────────────────────────────────────────────────────────
        [UnityTest]
        public IEnumerator Banner_DoesNotOverlapAnyOtherContent()
        {
            var fails = new List<string>();
            foreach (var p in PROFILES)
                foreach (var zh in new[] { false, true })
                    foreach (var st in STATES.Where(ShowsBanner))
                    {
                        yield return Bind(p, zh, st);
                        var all = Items();
                        var b = all.First(i => i.IsBanner);
                        foreach (var o in all.Where(i => !i.IsBanner))
                            if (Overlaps(b.R, o.R))
                                fails.Add($"{Ctx(p, zh, st)} OVERLAP banner{Fmt(b.R)} × {o.Region}\"{o.Text.Replace("\n", " / ")}\"{Fmt(o.R)}");
                    }
            CollectionAssert.IsEmpty(fails, "banner overlaps:\n" + string.Join("\n", fails.Take(20)));
        }

        // ── D. wrapping ─────────────────────────────────────────────────────────────────────────
        [UnityTest]
        public IEnumerator Banner_WrapIsBoundedAndDeterministic()
        {
            var fails = new List<string>();
            var first = new Dictionary<string, string>();
            foreach (var p in PROFILES)
                foreach (var zh in new[] { false, true })
                    foreach (var st in STATES.Where(ShowsBanner))
                    {
                        yield return Bind(p, zh, st);
                        var b = Items().First(i => i.IsBanner);
                        int lines = b.Text.Split('\n').Length;
                        if (lines > ShadowWorkspaceLayout.BannerMaxLines)
                            fails.Add($"{Ctx(p, zh, st)} {lines} lines > max {ShadowWorkspaceLayout.BannerMaxLines}");
                        // the wrap must not depend on the profile — same language + state ⇒ same text
                        string key = (zh ? "zh" : "en") + "|" + st;
                        if (first.TryGetValue(key, out var prev)) { if (prev != b.Text) fails.Add($"{Ctx(p, zh, st)} NON-DETERMINISTIC wrap"); }
                        else first[key] = b.Text;
                        foreach (var line in b.Text.Split('\n'))
                            if (line.Trim().Length == 0) fails.Add($"{Ctx(p, zh, st)} produced an empty line");
                    }
            CollectionAssert.IsEmpty(fails, "wrap failures:\n" + string.Join("\n", fails.Take(20)));
        }

        // ── H. regression invariants ────────────────────────────────────────────────────────────
        [UnityTest]
        public IEnumerator ShortTrackingHeaderAndNeighbouringGeometryAreUnchanged()
        {
            // the short header keeps its own row; the banner is a separate explanatory element
            yield return Bind(P.DesktopDark, false, "LOST");
            var all = Items();
            var header = all.First(i => i.Region == "region.top" && i.Text.StartsWith("tracking:"));
            var banner = all.First(i => i.IsBanner);
            Assert.IsFalse(Overlaps(header.R, banner.R), "the short tracking header and the banner must stay distinct");
            Assert.AreEqual("tracking: lost", header.Text, "short tracking header wording must not change");

            // d664873 colour + d7feb01 column geometry untouched
            Assert.AreEqual(ShadowLens.Generated.ShadowSemanticTokens.ColorFor("status", "FIRST_FAILURE", "DesktopDark"),
                ShadowStatusGlyph.Resolve("FIRST_FAILURE", "DesktopDark").ColorHex);
            Assert.AreEqual(2.58f, ShadowWorkspaceLayout.LeftWidth, 0.001f);
            Assert.AreEqual(3.18f, ShadowWorkspaceLayout.CenterWidth, 0.001f);
            Assert.AreEqual(1.84f, ShadowWorkspaceLayout.RightWidth, 0.001f);
            Assert.AreEqual(-1.98f, ShadowWorkspaceLayout.BottomY, 0.001f);
            Assert.AreEqual(0.1962f, ShadowWorkspaceLayout.BodyRowStep, 0.0005f);
            Assert.AreEqual(0.1962f, ShadowWorkspaceLayout.TrustPairStep, 0.0005f);
        }

        [UnityTest]
        public IEnumerator NonDegradedStates_RenderNoBanner()
        {
            foreach (var st in STATES.Where(s => !ShowsBanner(s)))
            {
                yield return Bind(P.DesktopDark, false, st);
                Assert.IsFalse(Items().Any(i => i.IsBanner), $"tracking={st} must not raise a degradation banner");
            }
        }
    }
}
#endif
