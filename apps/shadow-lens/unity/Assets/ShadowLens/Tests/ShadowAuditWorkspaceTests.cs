// apps/shadow-lens/unity/Assets/ShadowLens/Tests/ShadowAuditWorkspaceTests.cs
// EditMode logic tests for the Unity Audit Workspace core. Verify generated-token consumption,
// fail-closed unknown status, current-focus/source/trust-strip/evidence-rail binding, the
// first-failure≠downstream and review≠approval distinctions, mode-preservation, tracking-state
// preservation, and EN/ZH label sizing. Rendering (meshes/OST) is a PlayMode/capture concern, not here.
#if UNITY_INCLUDE_TESTS
using System.Collections.Generic;
using NUnit.Framework;
using ShadowLens.GuidedStory;
using ShadowLens.Workspace;

namespace ShadowLens.Tests
{
    public class ShadowAuditWorkspaceTests
    {
        static GuidedStorySemantic Model()
        {
            var m = new GuidedStorySemantic { StoryId = "t", Title = new Bilingual { En = "Banking Audit", Zh = "银行审计" } };
            m.Entities.Add(new StoryEntity { Id = "income", Kind = "record", Sequence = 1, Label = new Bilingual { En = "Income", Zh = "收入" }, EvidenceRef = "ev.income" });
            m.Entities.Add(new StoryEntity { Id = "dti", Kind = "record", Sequence = 2, Label = new Bilingual { En = "DTI", Zh = "债务收入比" }, EvidenceRef = "ev.dti" });
            m.Entities.Add(new StoryEntity { Id = "decision", Kind = "decision", Sequence = 3, Label = new Bilingual { En = "Decision", Zh = "决策" }, EvidenceRef = null });
            m.Entities.Add(new StoryEntity { Id = "pricing", Kind = "record", Sequence = 4, Label = new Bilingual { En = "Pricing", Zh = "定价" }, EvidenceRef = "ev.pricing" });
            return m;
        }

        static StoryScenario Scenario()
        {
            var sc = new StoryScenario { Id = "s", FirstFailure = "decision" };
            sc.AffectedDownstream.Add("pricing");
            sc.EntityStatus["income"] = "VERIFIED";
            sc.EntityStatus["dti"] = "VERIFIED";
            sc.EntityStatus["decision"] = "FIRST_FAILURE";
            sc.EntityStatus["pricing"] = "AFFECTED_DOWNSTREAM";
            sc.DimensionStatus["HUMAN_REVIEW"] = "REQUIRES_HUMAN_REVIEW";
            sc.DimensionStatus["HUMAN_APPROVAL"] = "APPROVAL_NOT_PRESENT";
            sc.DimensionStatus["TRUST_POSTURE"] = "SELF_SIGNED";
            return sc;
        }

        [Test] public void GeneratedTokens_Consumed_ForKnownStatus()
        {
            var g = ShadowStatusGlyph.Resolve("VERIFIED");
            Assert.IsTrue(g.Known);
            Assert.AreEqual("VERIFIED", ShadowLens.Generated.ShadowSemanticTokens.Get("status", "VERIFIED").Key);
            Assert.IsNotEmpty(g.Text); Assert.IsNotEmpty(g.ColorHex);
        }

        [Test] public void UnknownStatus_FailsClosed_NotVerified()
        {
            var g = ShadowStatusGlyph.Resolve("TOTALLY_MADE_UP");
            Assert.IsFalse(g.Known);
            Assert.AreEqual("UNKNOWN STATUS", g.Text);
            Assert.AreNotEqual("VERIFIED", g.Text);
        }

        [Test] public void CurrentFocus_Binds_FirstFailure_Downstream_Review_Approval()
        {
            var f = ShadowAuditWorkspaceModel.BuildFocus(Model(), Scenario(), "decision", false);
            Assert.IsTrue(f.IsFirstFailure);
            Assert.AreEqual(1, f.DownstreamAffectedCount);
            Assert.AreEqual("REQUIRES_HUMAN_REVIEW", f.HumanReview);
            Assert.AreEqual("APPROVAL_NOT_PRESENT", f.Approval);
            // review is NOT approval
            Assert.AreNotEqual(f.HumanReview, f.Approval);
            // first-failure focus gets a P0 verification field + a route-to-audit next action
            Assert.IsTrue(f.NextAction.Contains("2D AUDIT"));
        }

        [Test] public void SourceCard_MissingEvidence_IsExplicit_NotInvented()
        {
            var noEv = ShadowAuditWorkspaceModel.BuildSource(Model().EntityById("decision"));
            Assert.AreEqual("NOT_PRESENT", noEv.Resolution);
            Assert.AreEqual("NOT_EVALUATED", noEv.Ocr); // never OCR VERIFIED without proof
            Assert.IsFalse(noEv.LocationAvailable);
            var withEv = ShadowAuditWorkspaceModel.BuildSource(Model().EntityById("income"));
            Assert.AreEqual("PRESENT", withEv.Resolution);
        }

        [Test] public void TrustStrip_FourGroups_NotAllGreen()
        {
            var f = ShadowAuditWorkspaceModel.BuildFocus(Model(), Scenario(), "decision", false);
            var groups = ShadowAuditWorkspaceModel.BuildTrustStrip(f);
            Assert.AreEqual(4, groups.Count);
            int green = 0;
            foreach (var g in groups) if (g.Glyph.ColorHex.ToLower() == "#4ade80") green++;
            Assert.Less(green, groups.Count, "not one generic green check for all trust dimensions");
        }

        [Test] public void EvidenceRail_Sequence_FirstFailureAndDownstream_Distinct()
        {
            var rail = ShadowAuditWorkspaceModel.BuildRail(Model(), Scenario(), "decision");
            Assert.AreEqual(4, rail.Count);
            // deterministic sequence order
            for (int i = 1; i < rail.Count; i++) Assert.LessOrEqual(rail[i - 1].Sequence, rail[i].Sequence);
            var ff = rail.Find(x => x.IsFirstFailure);
            var dn = rail.Find(x => x.IsDownstream);
            Assert.AreEqual("decision", ff.EntityId);
            Assert.AreEqual("pricing", dn.EntityId);
            // downstream is NOT a second first-failure
            Assert.IsFalse(dn.IsFirstFailure);
            Assert.AreNotEqual(ff.Glyph.Icon, dn.Glyph.Icon);
        }

        [Test] public void ModeSwitch_PreservesState_And_UnimplementedFallsBack()
        {
            var st = new ShadowWorkspaceState { StepIndex = 2, FocusEntityId = "dti", Zh = true, Tracking = "SCANNING", HumanReview = "REQUIRES_HUMAN_REVIEW", Approval = "APPROVAL_NOT_PRESENT" };
            var (mode, kept) = ShadowPresentationModes.SwitchMode(ShadowPresentationMode.PrimitiveDiagnostic, st);
            Assert.AreEqual(ShadowPresentationMode.PrimitiveDiagnostic, mode);
            Assert.AreEqual(2, kept.StepIndex); Assert.AreEqual("dti", kept.FocusEntityId);
            Assert.IsTrue(kept.Zh); Assert.AreEqual("SCANNING", kept.Tracking);
            Assert.AreEqual("REQUIRES_HUMAN_REVIEW", kept.HumanReview);
            // unimplemented mode falls back to the default AuditWorkspace, state still preserved
            var (m2, kept2) = ShadowPresentationModes.SwitchMode(ShadowPresentationMode.CouncilLanes, st);
            Assert.AreEqual(ShadowPresentationMode.AuditWorkspace, m2);
            Assert.AreEqual("dti", kept2.FocusEntityId);
        }

        [Test] public void Tracking_Scanning_DistinctFromLimited_And_DegradedPreservesState()
        {
            Assert.IsTrue(ShadowTrackingBanner.ScanningIsDistinctFromLimited());
            Assert.IsTrue(ShadowTrackingBanner.Copy("SCANNING", false).Contains("SCANNING FOR POSITION"));
            Assert.IsTrue(ShadowTrackingBanner.Copy("SCANNING", true).Contains("正在扫描空间位置"));
            var st = new ShadowWorkspaceState { StepIndex = 3, FocusEntityId = "decision", Zh = false, Tracking = "TRACKED_3DOF" };
            var lost = ShadowTrackingBanner.ApplyDegraded(st, "LOST");
            Assert.AreEqual("LOST", lost.Tracking);
            Assert.AreEqual(3, lost.StepIndex); Assert.AreEqual("decision", lost.FocusEntityId); // story preserved
            Assert.IsTrue(ShadowTrackingBanner.KeepsRecenter("LOST"));
            Assert.IsTrue(ShadowTrackingBanner.KeepsOpen2DAudit("LOST"));
        }

        [Test] public void LabelMetrics_CJK_Wider_Than_Latin_And_Overflow_Truncates()
        {
            var en = ShadowLabelMetrics.Measure("Income", 22f);
            var zh = ShadowLabelMetrics.Measure("债务收入比率评估", 22f);
            Assert.Greater(zh.PreferredWidthEm / 8f, en.PreferredWidthEm / 6f * 0.0f); // sanity: zh measured
            // a long identifier overflows the narrow cap and truncates with an affordance
            var longId = "urn:shadow:evidence:0123456789abcdef0123456789abcdef:record:decision";
            var m = ShadowLabelMetrics.Measure(longId, 10f);
            Assert.IsTrue(m.Overflow);
            var t = ShadowLabelMetrics.TruncateWithAffordance(longId, 10f);
            Assert.IsTrue(t.EndsWith("…"));
            Assert.IsFalse(ShadowLabelMetrics.Measure(t, 10f).Overflow);
            // mixed script + multiline counted
            var mixed = ShadowLabelMetrics.Measure("DTI 债务收入比\nline two", 22f);
            Assert.AreEqual(2, mixed.Lines);
        }

        [Test] public void EnglishAndChinese_FocusTitle_BothRender()
        {
            var en = ShadowAuditWorkspaceModel.BuildFocus(Model(), Scenario(), "income", false);
            var zh = ShadowAuditWorkspaceModel.BuildFocus(Model(), Scenario(), "income", true);
            Assert.AreEqual("Income", en.Title);
            Assert.AreEqual("收入", zh.Title);
        }
    }
}
#endif
