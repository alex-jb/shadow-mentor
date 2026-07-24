// UX-01 / UX-05 / UX-09 Unity-side acceptance. The Node suite pins the token table; these pin the
// RUNTIME resolver — that a status renderer receives the active profile and can never silently fall
// back to the DesktopDark palette while another profile is on screen. Contrast uses the same WCAG 2.x
// formula over linearised sRGB, against each profile's own surface token. No image is compared.
#if UNITY_INCLUDE_TESTS
using System;
using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using ShadowLens.Generated;
using ShadowLens.Workspace;
using P = ShadowLens.Design.ShadowDesignTokens.ShadowVisualProfile;

namespace ShadowLens.Tests
{
    public class ShadowStatusProfileContrastTests
    {
        static double Chan(double v) => v <= 0.04045 ? v / 12.92 : Math.Pow((v + 0.055) / 1.055, 2.4);
        static double Luminance(string hex)
        {
            if (!ColorUtility.TryParseHtmlString(hex, out var c)) throw new ArgumentException("bad hex " + hex);
            return 0.2126 * Chan(c.r) + 0.7152 * Chan(c.g) + 0.0722 * Chan(c.b);
        }
        static double Contrast(string fg, string bg)
        {
            double a = Luminance(fg), b = Luminance(bg);
            return (Math.Max(a, b) + 0.05) / (Math.Min(a, b) + 0.05);
        }
        static string Why(string profile, string token, string fg, string bg, double need) =>
            $"profile={profile} token={token} fg={fg} bg={bg} Lfg={Luminance(fg):F4} Lbg={Luminance(bg):F4} " +
            $"ratio={Contrast(fg, bg):F2} required={need:F1}";

        static readonly string[] Profiles = { "AccessibilityHighContrast", "BrowserDark", "DesktopDark", "ProjectorPresentation", "XrealOstBright" };

        [Test]
        public void KnownReferencePairs_ContrastFormulaIsCorrect()
        {
            Assert.AreEqual(21.0, Contrast("#FFFFFF", "#000000"), 0.01);
            Assert.AreEqual(1.0, Contrast("#000000", "#000000"), 0.01);
        }

        [Test]
        public void EveryVisualProfileEnumMemberHasAPalette()
        {
            // A profile the enum can select but the tokens do not define would throw at render time.
            foreach (P p in Enum.GetValues(typeof(P)))
                Assert.DoesNotThrow(() => ShadowSemanticTokens.PaletteFor(p.ToString()), "no palette for " + p);
        }

        [Test]
        public void SameStatusResolvesDifferentlyPerProfile_NoSilentDesktopDarkFallback()
        {
            var dark = ShadowStatusGlyph.Resolve("VERIFIED", "DesktopDark").ColorHex;
            var ost = ShadowStatusGlyph.Resolve("VERIFIED", "XrealOstBright").ColorHex;
            var a11y = ShadowStatusGlyph.Resolve("VERIFIED", "AccessibilityHighContrast").ColorHex;
            Assert.AreNotEqual(dark, ost, "OST resolved through the DesktopDark palette — this is UX-01");
            Assert.AreNotEqual(dark, a11y, "AccessibilityHighContrast resolved through DesktopDark — this is UX-05");
        }

        [Test]
        public void UnknownProfileThrowsRatherThanFallingBack()
        {
            Assert.Throws<ArgumentException>(() => ShadowStatusGlyph.Resolve("VERIFIED", "NoSuchProfile"));
            Assert.Throws<ArgumentException>(() => ShadowSemanticTokens.PaletteFor("NoSuchProfile"));
        }

        [Test]
        public void IdentityIsProfileInvariant_OnlyTheRenditionChanges()
        {
            var baseline = ShadowStatusGlyph.Resolve("FIRST_FAILURE", "DesktopDark");
            foreach (var p in Profiles)
            {
                var g = ShadowStatusGlyph.Resolve("FIRST_FAILURE", p);
                Assert.AreEqual(baseline.Text, g.Text);
                Assert.AreEqual(baseline.TextZh, g.TextZh);
                Assert.AreEqual(baseline.Icon, g.Icon);
                Assert.AreEqual(baseline.Shape, g.Shape);
                Assert.IsTrue(g.Known);
            }
        }

        [Test]
        public void UnknownStatusStillFailsClosed_AndFollowsTheActiveProfile()
        {
            foreach (var p in Profiles)
            {
                var g = ShadowStatusGlyph.Resolve("NOT_A_REAL_STATUS", p);
                Assert.IsFalse(g.Known);
                Assert.AreEqual("UNKNOWN STATUS", g.Text, "must never resolve to VERIFIED");
                Assert.AreEqual(ShadowStatusGlyph.FamilyColor("neutral_unknown", p), g.ColorHex,
                    "the fail-closed rendition must follow the active profile too");
            }
        }

        [Test]
        public void EverySemanticStateClearsItsProfileContrastFloor()
        {
            var failures = new List<string>();
            foreach (var p in Profiles)
            {
                var pal = ShadowSemanticTokens.PaletteFor(p);
                foreach (var t in ShadowSemanticTokens.All)
                {
                    var fg = ShadowSemanticTokens.ColorFor(t.Category, t.Key, p);
                    double need = t.Family == "edge_muted" ? pal.GraphicFloor : pal.TextFloor;
                    if (Contrast(fg, pal.Surface) < need)
                        failures.Add(Why(p, t.Category + "." + t.Key, fg, pal.Surface, need));
                }
            }
            CollectionAssert.IsEmpty(failures, "contrast failures:\n" + string.Join("\n", failures));
        }

        [Test]
        public void DisclaimerClears45OnEveryProfileSurface()
        {
            var failures = new List<string>();
            foreach (var p in Profiles)
            {
                var pal = ShadowSemanticTokens.PaletteFor(p);
                var fg = ShadowStatusGlyph.DisclaimerColor(p);
                if (Contrast(fg, pal.Surface) < 4.5) failures.Add(Why(p, "disclaimer", fg, pal.Surface, 4.5));
            }
            CollectionAssert.IsEmpty(failures, "disclaimer failures:\n" + string.Join("\n", failures));
        }

        [Test]
        public void WorkspacePassesItsActiveProfileToStatusResolution()
        {
            // The regression that matters: switching the workspace profile must change the rendered
            // status colour. If a renderer forgot to pass ProfileId these would be equal.
            var go = new GameObject("ws-contrast-probe");
            try
            {
                var ws = go.AddComponent<ShadowAuditWorkspace>();
                var seen = new HashSet<string>();
                foreach (var prof in new[] { P.DesktopDark, P.XrealOstBright, P.AccessibilityHighContrast })
                {
                    ws.Profile = prof;
                    seen.Add(ShadowStatusGlyph.Resolve("FIRST_FAILURE", ws.Profile.ToString()).ColorHex);
                }
                Assert.AreEqual(3, seen.Count, "the three profiles must render FIRST_FAILURE in three distinct colours");
            }
            finally { UnityEngine.Object.DestroyImmediate(go); }
        }

        [Test]
        public void EnglishAndChineseSelectTheSamePalette()
        {
            foreach (var p in Profiles)
            {
                // colour resolution has no language input — pinned so a future overload cannot add one
                var g = ShadowStatusGlyph.Resolve("APPROVAL_NOT_PRESENT", p);
                Assert.AreEqual(ShadowSemanticTokens.ColorFor("governance", "APPROVAL_NOT_PRESENT", p), g.ColorHex);
                Assert.IsNotEmpty(g.Text);
                Assert.IsNotEmpty(g.TextZh);
            }
        }
    }
}
#endif
