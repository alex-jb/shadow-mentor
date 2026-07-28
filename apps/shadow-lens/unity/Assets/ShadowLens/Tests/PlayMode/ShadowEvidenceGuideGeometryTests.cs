// UX-14 acceptance: inside the bottom evidence guide, the sequence index, node, top label and action
// legend must not touch. Uses the deterministic analytic pinhole projection from d7feb01/01864b4
// (never Camera.WorldToScreenPoint, which in batchmode projects into the window size). Thresholds come
// from ShadowWorkspaceLayout.Rail* — the values production renders with.
//
// Untouched by construction: the guide's evidence order, numbering and status colours; UX-08 (the
// band the stack borrows stays open); every other region (asserted no-overlap).
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
    public class ShadowEvidenceGuideGeometryTests
    {
        const int W = L.CaptureRig.PixelWidth, H = L.CaptureRig.PixelHeight;
        ShadowAuditWorkspace _ws; GameObject _root; Font _cjk;

        // records is the number of evidence steps; firstFailure names which one fails (or null)
        static GuidedStorySemantic Model(int records)
        {
            var m = new GuidedStorySemantic { StoryId = "banking", Title = new Bilingual { En = "Banking Audit", Zh = "银行审计" } };
            var names = new (string id, string en, string zh)[]
            {
                ("income", "Income", "收入"), ("dti", "Debt-to-Income Ratio", "债务收入比"),
                ("decision", "Council Decision", "委员会决策"), ("pricing", "Pricing Tier", "定价档位"),
                ("disclosure", "Disclosure Package", "披露材料"), ("covenant", "Covenant Schedule", "契约计划"),
            };
            for (int i = 0; i < records; i++)
            {
                var n = names[i];
                m.Entities.Add(new StoryEntity { Id = n.id, Kind = n.id == "decision" ? "decision" : "record",
                    Sequence = i + 1, Label = new Bilingual { En = n.en, Zh = n.zh }, EvidenceRef = "ev." + n.id });
            }
            return m;
        }
        static StoryScenario Scenario(GuidedStorySemantic m, int firstFailureIndex, bool sourceMissing = false)
        {
            var sc = new StoryScenario { Id = "s" };
            for (int i = 0; i < m.Entities.Count; i++)
            {
                var id = m.Entities[i].Id;
                if (firstFailureIndex >= 0 && i == firstFailureIndex) { sc.FirstFailure = id; sc.EntityStatus[id] = "FIRST_FAILURE"; }
                else if (firstFailureIndex >= 0 && i > firstFailureIndex) { sc.AffectedDownstream.Add(id); sc.EntityStatus[id] = "AFFECTED_DOWNSTREAM"; }
                else sc.EntityStatus[id] = sourceMissing && i == 0 ? "NOT_PRESENT" : "VERIFIED";
            }
            sc.DimensionStatus["HUMAN_REVIEW"] = "REQUIRES_HUMAN_REVIEW";
            sc.DimensionStatus["HUMAN_APPROVAL"] = "APPROVAL_NOT_PRESENT";
            sc.DimensionStatus["TRUST_POSTURE"] = "SELF_SIGNED";
            return sc;
        }

        [SetUp]
        public void Setup()
        {
            _cjk = Font.CreateDynamicFontFromOSFont(new[] { "Hiragino Sans GB", "STHeiti", "PingFang SC", "Arial Unicode MS" }, 64);
            _root = new GameObject("GuideWorkspace");
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
        static float CenterDist(Rect a, Rect b) => Vector2.Distance(a.center, b.center);
        static string Fmt(Rect r) => $"[{r.xMin:F0},{r.yMin:F0} → {r.xMax:F0},{r.yMax:F0}]";

        struct El { public string Region, Text, Kind; public Rect R; }
        List<El> RailElements()
        {
            var o = new List<El>();
            var region = _root.transform.Cast<Transform>().FirstOrDefault(t => t.name == "region.bottom");
            if (region == null) return o;
            foreach (var tm in region.GetComponentsInChildren<TextMesh>(false))
            {
                if (string.IsNullOrWhiteSpace(tm.text)) continue;
                var r = tm.GetComponent<Renderer>(); if (r == null || !r.enabled) continue;
                string kind = tm.text.StartsWith("#") ? "seq"
                    : (tm.text.Contains("◀") || tm.text.Contains("Prev") || tm.text.Contains("上一步")) ? "action"
                    : "toplabel";
                o.Add(new El { Region = "region.bottom", Text = tm.text, Kind = kind, R = Project(r) });
            }
            foreach (var mf in region.GetComponentsInChildren<MeshFilter>(false))
            {
                if (mf.GetComponent<TextMesh>() != null) continue;
                var r = mf.GetComponent<Renderer>(); if (r == null || !r.enabled) continue;
                o.Add(new El { Region = "region.bottom", Text = "node", Kind = "node", R = Project(r) });
            }
            return o;
        }
        List<El> AllLabels()
        {
            var o = new List<El>();
            foreach (Transform reg in _root.transform)
                foreach (var tm in reg.GetComponentsInChildren<TextMesh>(false))
                {
                    if (string.IsNullOrWhiteSpace(tm.text)) continue;
                    var r = tm.GetComponent<Renderer>(); if (r == null || !r.enabled) continue;
                    o.Add(new El { Region = reg.name, Text = tm.text, R = Project(r) });
                }
            return o;
        }

        static readonly P[] PROFILES = { P.DesktopDark, P.BrowserDark, P.ProjectorPresentation, P.XrealOstBright, P.AccessibilityHighContrast };
        string Ctx(P p, bool zh, string st) => $"profile={p} lang={(zh ? "zh-CN" : "en")} state={st}";

        // (name, records, firstFailureIndex, sourceMissing)
        static IEnumerable<(string n, int rec, int ff, bool sm)> STATES()
        {
            yield return ("normal-4", 4, -1, false);
            yield return ("first-failure-mid", 4, 2, false);   // decision at step 3, downstream at 4
            yield return ("first-failure-first", 4, 0, false);
            yield return ("first-failure-last", 4, 3, false);
            yield return ("source-missing-no-failure", 4, -1, true);
            yield return ("one-step", 1, -1, false);
            yield return ("two-step", 2, 0, false);
            yield return ("three-step", 3, 1, false);
            yield return ("max-steps", 6, 2, false);
        }

        IEnumerator Bind(P p, bool zh, (string n, int rec, int ff, bool sm) st)
        {
            var m = Model(st.rec);
            string focus = st.ff >= 0 ? m.Entities[st.ff].Id : m.Entities[0].Id;
            _ws.Profile = p; _ws.Zh = zh; _ws.Tracking = "TRACKED_3DOF";
            _ws.BindDirect(m, Scenario(m, st.ff, st.sm), focus);
            yield return null; yield return null; yield return null; yield return null;
        }

        // ── A. containment ──────────────────────────────────────────────────────────────────────
        [UnityTest]
        public IEnumerator Guide_StaysInsideTheViewport()
        {
            var fails = new List<string>();
            foreach (var p in PROFILES)
                foreach (var zh in new[] { false, true })
                    foreach (var st in STATES())
                    {
                        yield return Bind(p, zh, st);
                        foreach (var e in RailElements())
                            if (e.R.yMin < 0 || e.R.yMax > H || e.R.xMin < 0 || e.R.xMax > W)
                                fails.Add($"{Ctx(p, zh, st.n)} {e.Kind}\"{e.Text}\" CLIPPED {Fmt(e.R)}");
                    }
            CollectionAssert.IsEmpty(fails, "guide clipping:\n" + string.Join("\n", fails.Take(20)));
        }

        // ── B. internal collisions ──────────────────────────────────────────────────────────────
        [UnityTest]
        public IEnumerator GuideElements_DoNotOverlapEachOther()
        {
            var fails = new List<string>();
            foreach (var p in PROFILES)
                foreach (var zh in new[] { false, true })
                    foreach (var st in STATES())
                    {
                        yield return Bind(p, zh, st);
                        var els = RailElements();
                        for (int i = 0; i < els.Count; i++)
                            for (int j = i + 1; j < els.Count; j++)
                            {
                                // a sequence index sitting under its OWN node is fine only if they do not
                                // actually overlap; the vertical stack guarantees they do not.
                                if (Overlaps(els[i].R, els[j].R))
                                    fails.Add($"{Ctx(p, zh, st.n)} OVERLAP {els[i].Kind}\"{els[i].Text}\"{Fmt(els[i].R)} × {els[j].Kind}\"{els[j].Text}\"{Fmt(els[j].R)}");
                            }
                    }
            CollectionAssert.IsEmpty(fails, "internal guide overlaps:\n" + string.Join("\n", fails.Take(25)));
        }

        // ── C. association: each seq index is closest to its own node ────────────────────────────
        [UnityTest]
        public IEnumerator EachIndexAndTopLabel_IsClosestToItsOwnNode()
        {
            var fails = new List<string>();
            foreach (var p in PROFILES)
                foreach (var zh in new[] { false, true })
                    foreach (var st in STATES().Where(s => s.rec >= 2))
                    {
                        yield return Bind(p, zh, st);
                        var els = RailElements();
                        var nodes = els.Where(e => e.Kind == "node").OrderBy(e => e.R.center.x).ToList();
                        // indices left-to-right must map to nodes left-to-right (order preserved)
                        var seqs = els.Where(e => e.Kind == "seq").OrderBy(e => e.R.center.x).ToList();
                        if (seqs.Count != nodes.Count) { fails.Add($"{Ctx(p, zh, st.n)} {seqs.Count} indices vs {nodes.Count} nodes"); continue; }
                        for (int i = 0; i < seqs.Count; i++)
                        {
                            int nearest = 0; float best = float.MaxValue;
                            for (int k = 0; k < nodes.Count; k++) { float d = Mathf.Abs(seqs[i].R.center.x - nodes[k].R.center.x); if (d < best) { best = d; nearest = k; } }
                            if (nearest != i) fails.Add($"{Ctx(p, zh, st.n)} index \"{seqs[i].Text}\" is nearest node #{nearest + 1}, not its own #{i + 1}");
                        }
                    }
            CollectionAssert.IsEmpty(fails, "index/node association:\n" + string.Join("\n", fails.Take(20)));
        }

        // ── D. step counts ──────────────────────────────────────────────────────────────────────
        [UnityTest]
        public IEnumerator EveryStepCount_RendersOneNodeAndOneIndexPerStep()
        {
            var fails = new List<string>();
            foreach (var p in new[] { P.DesktopDark, P.XrealOstBright })
                foreach (var st in STATES())
                {
                    yield return Bind(p, false, st);
                    var els = RailElements();
                    int nodes = els.Count(e => e.Kind == "node"), seqs = els.Count(e => e.Kind == "seq");
                    if (nodes != st.rec) fails.Add($"{Ctx(p, false, st.n)} {nodes} nodes for {st.rec} steps");
                    if (seqs != st.rec) fails.Add($"{Ctx(p, false, st.n)} {seqs} indices for {st.rec} steps");
                }
            CollectionAssert.IsEmpty(fails, "step-count rendering:\n" + string.Join("\n", fails.Take(20)));
        }

        // ── cross-region: the guide must not collide with any other region ──────────────────────
        [UnityTest]
        public IEnumerator Guide_DoesNotOverlapOtherRegions()
        {
            var fails = new List<string>();
            foreach (var p in PROFILES)
                foreach (var zh in new[] { false, true })
                    foreach (var st in new[] { STATES().First(s => s.n == "first-failure-mid"), STATES().First(s => s.n == "max-steps") })
                    {
                        yield return Bind(p, zh, st);
                        var rail = RailElements();
                        var others = AllLabels().Where(l => l.Region != "region.bottom").ToList();
                        foreach (var e in rail)
                            foreach (var o in others)
                                if (Overlaps(e.R, o.R))
                                    fails.Add($"{Ctx(p, zh, st.n)} guide {e.Kind}\"{e.Text}\" × {o.Region}\"{o.Text.Replace("\n", " / ")}\"");
                    }
            CollectionAssert.IsEmpty(fails, "guide vs other regions:\n" + string.Join("\n", fails.Take(20)));
        }

        // ── G. regression invariants ────────────────────────────────────────────────────────────
        [UnityTest]
        public IEnumerator EvidenceSemanticsAndPriorContractsUnchanged()
        {
            yield return Bind(P.DesktopDark, false, STATES().First(s => s.n == "first-failure-mid"));
            var els = RailElements();
            // sequence order 1..4 present and left-to-right
            var seqs = els.Where(e => e.Kind == "seq").OrderBy(e => e.R.center.x).Select(e => e.Text).ToList();
            CollectionAssert.AreEqual(new[] { "#1", "#2", "#3", "#4" }, seqs, "evidence numbering/order must be unchanged");
            Assert.IsTrue(els.Any(e => e.Kind == "toplabel" && e.Text == ShadowWorkspaceLabels.Get("first_short", false)),
                "the first-failure step must still carry its marker");

            // prior contracts untouched
            Assert.AreEqual(2.58f, L.LeftWidth, 0.001f);
            Assert.AreEqual(3.18f, L.CenterWidth, 0.001f);
            Assert.AreEqual(-1.98f, L.BottomY, 0.001f);         // guide REGION not moved
            Assert.AreEqual(0.1962f, L.BodyRowStep, 0.0005f);
            Assert.AreEqual(4.20f, L.BannerLocalX, 0.001f);     // 01864b4
            Assert.AreEqual(0.046f, L.ConclusionSize, 0.0001f); // 3c5e9ba
            Assert.AreEqual(ShadowLens.Generated.ShadowSemanticTokens.ColorFor("status", "FIRST_FAILURE", "DesktopDark"),
                ShadowStatusGlyph.Resolve("FIRST_FAILURE", "DesktopDark").ColorHex); // d664873

            // Chinese numbering identical
            yield return Bind(P.DesktopDark, true, STATES().First(s => s.n == "first-failure-mid"));
            var zhSeqs = RailElements().Where(e => e.Kind == "seq").OrderBy(e => e.R.center.x).Select(e => e.Text).ToList();
            CollectionAssert.AreEqual(new[] { "#1", "#2", "#3", "#4" }, zhSeqs);
        }
    }
}
#endif
