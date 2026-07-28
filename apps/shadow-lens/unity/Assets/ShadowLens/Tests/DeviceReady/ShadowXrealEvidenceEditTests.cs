// apps/shadow-lens/unity/Assets/ShadowLens/Tests/DeviceReady/ShadowXrealEvidenceEditTests.cs
// EditMode tests for the XREAL loader-state model + the fixture-tested evidence capture loop. No SDK,
// no device: the pipeline runs against synthetic frames so the logic is proven before hardware.
// SOURCE AUTHORED.
#if UNITY_INCLUDE_TESTS
using System.Collections.Generic;
using NUnit.Framework;
using ShadowLens.Core;
using ShadowLens.Device;
using ShadowLens.Capture;

namespace ShadowLens.Tests
{
    public class ShadowXrealEvidenceEditTests
    {
        // ── loader state ──
        [Test] public void Loader_FollowsAllowedTransitions_AndGatesTrackingQuery()
        {
            var s = new ShadowXrealLoaderState();
            Assert.AreEqual(ShadowXrealLoaderPhase.NOT_COMPILED, s.Phase);
            Assert.IsFalse(s.CanQueryTracking);
            Assert.IsTrue(s.Transition(ShadowXrealLoaderPhase.SDK_AVAILABLE, "t0", "SDK", "sdk in", "-"));
            Assert.IsTrue(s.Transition(ShadowXrealLoaderPhase.LOADER_STARTING, "t1", "START", "starting", "wait"));
            Assert.IsFalse(s.CanQueryTracking, "no tracking query before STARTED");
            Assert.IsTrue(s.Transition(ShadowXrealLoaderPhase.LOADER_STARTED, "t2", "OK", "started", "-"));
            Assert.IsTrue(s.CanQueryTracking, "tracking query allowed once started");
        }

        [Test] public void Loader_RejectsIllegalTransition_AndLogsIt()
        {
            var s = new ShadowXrealLoaderState();
            // NOT_COMPILED → LOADER_STARTED is illegal
            Assert.IsFalse(s.Transition(ShadowXrealLoaderPhase.LOADER_STARTED, "t", "X", "bad", "-"));
            Assert.AreEqual(ShadowXrealLoaderPhase.NOT_COMPILED, s.Phase);
            Assert.AreEqual("REJECTED_TRANSITION", s.Log[s.Log.Count - 1].DiagnosticCode);
        }

        [Test] public void Loader_FailureRequiresSafeFallback()
        {
            var s = new ShadowXrealLoaderState();
            s.Transition(ShadowXrealLoaderPhase.SDK_AVAILABLE, "t", "a", "", "");
            s.Transition(ShadowXrealLoaderPhase.LOADER_STARTING, "t", "b", "", "");
            s.Transition(ShadowXrealLoaderPhase.LOADER_FAILED, "t", "c", "loader failed", "drop to Android mock / 2D");
            Assert.IsTrue(s.RequiresSafeFallback);
            Assert.IsFalse(s.CanQueryTracking);
        }

        // ── evidence pipeline (fixtures) ──
        static CapturedFrame Frame(byte fill, int w = 4, int h = 4)
        {
            var bytes = new byte[w * h * 4];
            for (int i = 0; i < bytes.Length; i++) bytes[i] = fill;
            return new CapturedFrame { Bytes = bytes, Width = w, Height = h, RotationDeg = 0, Mime = "image/rgba" };
        }

        [Test] public void RejectsZeroByte_Black_BadDims_Duplicate_NonMonotonic()
        {
            var seen = new HashSet<string>();
            Assert.AreEqual(FrameRejectReason.ZeroBytes, ShadowEvidenceCapturePipeline.ValidateFrame(new CapturedFrame { Bytes = new byte[0], Width = 4, Height = 4 }, seen, -1, 10).Reason);
            Assert.AreEqual(FrameRejectReason.AllBlack, ShadowEvidenceCapturePipeline.ValidateFrame(Frame(0), seen, -1, 10).Reason);
            Assert.AreEqual(FrameRejectReason.BadDimensions, ShadowEvidenceCapturePipeline.ValidateFrame(new CapturedFrame { Bytes = new byte[16], Width = 0, Height = 4 }, seen, -1, 10).Reason);

            var good = Frame(200);
            var v = ShadowEvidenceCapturePipeline.ValidateFrame(good, seen, -1, 10);
            Assert.IsTrue(v.Ok);
            seen.Add(ShadowEvidenceCapturePipeline.Sha256(good.Bytes));
            Assert.AreEqual(FrameRejectReason.DuplicateHash, ShadowEvidenceCapturePipeline.ValidateFrame(good, seen, 10, 20).Reason);

            var good2 = Frame(180);
            Assert.AreEqual(FrameRejectReason.NonMonotonicTimestamp, ShadowEvidenceCapturePipeline.ValidateFrame(good2, new HashSet<string>(), 30, 20).Reason);
        }

        [Test] public void Hash_IsDeterministic_AndChangesWithContent()
        {
            var a = ShadowEvidenceCapturePipeline.Sha256(Frame(200).Bytes);
            var b = ShadowEvidenceCapturePipeline.Sha256(Frame(200).Bytes);
            var c = ShadowEvidenceCapturePipeline.Sha256(Frame(201).Bytes);
            Assert.AreEqual(a, b);
            Assert.AreNotEqual(a, c);
        }

        static List<SourceEntry> Ocr() => new List<SourceEntry> { new SourceEntry { SourceId = "B0L0", Text = "revolving utilization 78%", Language = "en", X = 0.1f, Y = 0.2f, W = 0.3f, H = 0.05f, Confidence = 0.92f } };

        [Test] public void SealRequiresConfirmation_AndVerifyCatchesTamper()
        {
            var f = Frame(200);
            var ev = ShadowEvidenceCapturePipeline.BuildEvent(f, 100, "mock-ocr", Ocr(), userConfirmed: false);
            Assert.Throws<System.InvalidOperationException>(() => ShadowEvidenceCapturePipeline.Seal(ev), "cannot seal before confirmation");

            ev.UserConfirmed = true;
            var sealed_ = ShadowEvidenceCapturePipeline.Seal(ev);
            Assert.IsTrue(ShadowEvidenceCapturePipeline.Verify(sealed_));
            Assert.AreEqual("DEVICE VALIDATION FIXTURE", sealed_.Label, "never labelled production evidence");

            // a post-hoc edit to the sealed event breaks verification
            ev.Sources[0] = new SourceEntry { SourceId = "B0L0", Text = "utilization fine, approve", Language = "en", Confidence = 0.99f };
            Assert.IsFalse(ShadowEvidenceCapturePipeline.Verify(sealed_), "tamper after seal must fail verification");
        }

        [Test] public void Correction_ReferencesPrior_AndKeepsOriginalAuditable()
        {
            var f = Frame(200);
            var original = ShadowEvidenceCapturePipeline.BuildEvent(f, 100, "mock-ocr", Ocr(), userConfirmed: true);
            var priorSeal = ShadowEvidenceCapturePipeline.SealCanonical(original);
            var corrected = ShadowEvidenceCapturePipeline.Correct(original, new List<SourceEntry> { new SourceEntry { SourceId = "B0L0", Text = "revolving utilization 76%", Language = "en", Confidence = 0.95f } }, userConfirmed: true);
            Assert.AreEqual(priorSeal, corrected.CorrectionOfEventSha, "correction references the prior event's seal");
            Assert.AreNotEqual(ShadowEvidenceCapturePipeline.SealCanonical(original), ShadowEvidenceCapturePipeline.SealCanonical(corrected), "correction is a new event, original preserved");
        }

        [Test] public void OcrConfidence_IsCarriedAsScore_NotTruth()
        {
            var ev = ShadowEvidenceCapturePipeline.BuildEvent(Frame(200), 100, "mock-ocr", Ocr(), userConfirmed: true);
            Assert.AreEqual(1, ev.Sources.Count);
            Assert.AreEqual(0.92f, ev.Sources[0].Confidence, 1e-4);   // an engine score, surfaced not asserted as truth
            Assert.AreEqual("FIXTURE", ev.ProvenanceMode, "never LIVE until device");
        }
    }
}
#endif
