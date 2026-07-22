// apps/shadow-lens/unity/Assets/ShadowLens/Tests/DeviceReady/ShadowDeviceReadyEditTests.cs
// EditMode tests for the V5 capability model + input safety. Fail-closed by default; no unsafe
// inference (Beam Pro from Android, 6DoF from glasses, Eye from a symbol); the five officially-
// unsupported capabilities can never be set; destructive input actions require a separate Confirm.
// Pure — no headset. SOURCE AUTHORED — run under Unity Test Runner to execute.
#if UNITY_INCLUDE_TESTS
using System.Collections.Generic;
using NUnit.Framework;
using ShadowLens.Core;
using ShadowLens.Device;
using ShadowLens.InputV5;

namespace ShadowLens.Tests
{
    public class ShadowDeviceReadyEditTests
    {
        // A mock probe: every fact defaults false / None (fail closed). Tests flip only what they assert.
        sealed class MockProbe : IShadowDeviceProbe
        {
            public bool _editor, _android, _beam, _sdk, _loader, _eye, _translate, _rgb, _frame, _ctrl, _emu, _evidence;
            public TrackingMode _mode = TrackingMode.None;
            public bool IsEditor => _editor;
            public bool IsAndroid => _android;
            public bool IsBeamProHost => _beam;
            public bool XrealSdkAvailableAtRuntime => _sdk;
            public bool XrealLoaderStarted => _loader;
            public TrackingMode ReportedTrackingMode => _mode;
            public bool EyeAddOnDetected => _eye;
            public bool PositionalTranslationObserved => _translate;
            public bool RgbCameraPresent => _rgb;
            public bool NonBlackFrameObserved => _frame;
            public bool Controller3DofConnected => _ctrl;
            public bool EmulatorActive => _emu;
            public bool DeviceValidationEvidencePresent => _evidence;
        }

        [Test] public void NullProbe_FailsClosedToDesktopMock()
        {
            var p = ShadowDeviceCapabilityDetector.Detect(null);
            Assert.AreEqual(ShadowDegradationLevel.DesktopMock, p.Level);
            Assert.AreEqual(ShadowSessionState.DesktopMock, p.State);
            Assert.AreEqual(ShadowCapability.None, p.Flags);
        }

        [Test] public void BeamPro_NotInferredFromAndroidAlone()
        {
            var p = ShadowDeviceCapabilityDetector.Detect(new MockProbe { _android = true });
            Assert.IsFalse(p.Has(ShadowCapability.PLATFORM_BEAM_PRO), "Beam Pro must not come from Android alone");
            Assert.AreEqual(ShadowDegradationLevel.AndroidMock, p.Level);
        }

        [Test] public void SixDof_NotInferredFromGlassesOrSdkSymbolAlone()
        {
            // SDK + loader + reported SixDof but NO Eye and NO translation → still not 6DoF.
            var noEye = ShadowDeviceCapabilityDetector.Detect(new MockProbe { _android = true, _sdk = true, _loader = true, _mode = TrackingMode.SixDof });
            Assert.IsFalse(noEye.Has(ShadowCapability.TRACKING_6DOF), "6DoF requires the Eye + observed translation");
            Assert.IsTrue(noEye.Has(ShadowCapability.TRACKING_3DOF), "still 3DoF");
            Assert.AreEqual(ShadowDegradationLevel.Xreal3Dof, noEye.Level);
        }

        [Test] public void SixDof_RequiresEyePlusSixDofPlusTranslation()
        {
            var full = new MockProbe { _android = true, _beam = true, _sdk = true, _loader = true, _eye = true, _mode = TrackingMode.SixDof, _translate = true, _evidence = true };
            var p = ShadowDeviceCapabilityDetector.Detect(full);
            Assert.IsTrue(p.Has(ShadowCapability.TRACKING_6DOF));
            Assert.AreEqual(ShadowDegradationLevel.XrealEye6Dof, p.Level);
            Assert.AreEqual(ShadowSessionState.XrealEye6DofSession, p.State);
        }

        [Test] public void UnsupportedCapabilities_AreNeverSet()
        {
            // Even a maximal probe cannot turn on plane/image/hand/depth/anchor.
            var p = ShadowDeviceCapabilityDetector.Detect(new MockProbe { _android = true, _beam = true, _sdk = true, _loader = true, _eye = true, _mode = TrackingMode.SixDof, _translate = true, _rgb = true, _frame = true, _ctrl = true, _evidence = true });
            Assert.IsFalse(p.AnyUnsupportedClaimed, "officially-unsupported capabilities must stay off");
            Assert.AreEqual(5, p.UnsupportedByOfficialLimit().Count);
        }

        [Test] public void DeviceValidated_RequiresEvidenceAndNotEditorOrEmulator()
        {
            var editor = ShadowDeviceCapabilityDetector.Detect(new MockProbe { _editor = true, _emu = true, _evidence = true });
            Assert.IsFalse(editor.Has(ShadowCapability.DEVICE_VALIDATED), "editor/emulator is never device-validated");
            var device = ShadowDeviceCapabilityDetector.Detect(new MockProbe { _android = true, _sdk = true, _loader = true, _mode = TrackingMode.ThreeDof, _evidence = true });
            Assert.IsTrue(device.Has(ShadowCapability.DEVICE_VALIDATED));
        }

        [Test] public void FirstPersonView_NotClaimedUntilNonBlackFrame()
        {
            var noFrame = ShadowDeviceCapabilityDetector.Detect(new MockProbe { _android = true, _sdk = true, _loader = true, _eye = true, _mode = TrackingMode.SixDof, _translate = true, _rgb = true, _frame = false });
            Assert.IsTrue(noFrame.Has(ShadowCapability.RGB_CAMERA_AVAILABLE));
            Assert.IsFalse(noFrame.Has(ShadowCapability.FIRST_PERSON_VIEW_AVAILABLE), "no first-person view without a valid frame");
            Assert.AreEqual(ShadowSessionState.CameraUnavailable, noFrame.State);
        }

        [Test] public void TrackingHealth_OverridesToLimitedOrLost()
        {
            var probe = new MockProbe { _android = true, _sdk = true, _loader = true, _mode = TrackingMode.ThreeDof, _evidence = true };
            Assert.AreEqual(ShadowSessionState.TrackingLost, ShadowDeviceCapabilityDetector.Detect(probe, ShadowTrackingHealth.Lost).State);
            Assert.AreEqual(ShadowSessionState.TrackingLimited, ShadowDeviceCapabilityDetector.Detect(probe, ShadowTrackingHealth.Limited).State);
        }

        [Test] public void TrackingStateMachine_ScanningIsLimited_NotLost()
        {
            var ts = new ShadowTrackingState();
            Assert.IsFalse(ts.CanQueryTrackingType, "must not query tracking type before loader start");
            ts.OnLoaderStarted();
            ts.Report(ShadowNotTrackingReason.Scanning, isTracking: false);
            Assert.AreEqual(ShadowTrackingHealth.Limited, ts.Health);
            ts.Report(ShadowNotTrackingReason.None, isTracking: true);
            Assert.AreEqual(ShadowTrackingHealth.Nominal, ts.Health);
            ts.Report(ShadowNotTrackingReason.Unknown, isTracking: false);
            Assert.AreEqual(ShadowTrackingHealth.Lost, ts.Health);
        }

        [Test] public void EveryStateHasHonestBilingualInfoWithRecovery()
        {
            foreach (ShadowSessionState s in System.Enum.GetValues(typeof(ShadowSessionState)))
            {
                var info = ShadowSessionStateInfo.Get(s);
                Assert.IsNotEmpty(info.Label(false)); Assert.IsNotEmpty(info.Label(true));
                Assert.IsNotEmpty(info.Explain(false)); Assert.IsNotEmpty(info.Recovery(false));
                Assert.IsNotNull(info.AvailableEn); Assert.IsNotNull(info.UnavailableEn);
            }
        }

        // ── input safety ──
        sealed class RecordingSink : IShadowInputSink
        {
            public readonly List<ShadowInputAction> Dispatched = new List<ShadowInputAction>();
            public void Dispatch(ShadowInputAction a) => Dispatched.Add(a);
        }

        [Test] public void PassiveChannel_OnlyProducesFocus()
        {
            var sink = new RecordingSink();
            var r = new ShadowInputRouter(sink);
            r.SubmitPassive(ShadowInputAction.Focus);
            r.SubmitPassive(ShadowInputAction.Select);   // must be blocked
            r.SubmitPassive(ShadowInputAction.Confirm);  // must be blocked
            Assert.AreEqual(1, sink.Dispatched.Count);
            Assert.AreEqual(ShadowInputAction.Focus, sink.Dispatched[0]);
        }

        [Test] public void DestructiveAction_RequiresSeparateConfirm()
        {
            var sink = new RecordingSink();
            var r = new ShadowInputRouter(sink);
            r.Submit(ShadowInputAction.ResetDemo);   // armed, not dispatched
            Assert.AreEqual(0, sink.Dispatched.Count);
            Assert.IsTrue(r.PendingConfirmation.HasValue);
            r.Submit(ShadowInputAction.NextStep);    // ignored while pending
            Assert.AreEqual(0, sink.Dispatched.Count);
            r.Submit(ShadowInputAction.Confirm);     // now it fires
            Assert.AreEqual(1, sink.Dispatched.Count);
            Assert.AreEqual(ShadowInputAction.ResetDemo, sink.Dispatched[0]);
        }

        [Test] public void BackCancel_AbortPendingConfirmationAndAreAlwaysReachable()
        {
            var sink = new RecordingSink();
            var r = new ShadowInputRouter(sink);
            r.Submit(ShadowInputAction.ResetDemo);
            r.Submit(ShadowInputAction.Back);        // aborts + dispatches Back
            Assert.IsFalse(r.PendingConfirmation.HasValue);
            Assert.Contains(ShadowInputAction.Back, sink.Dispatched);
            Assert.IsFalse(sink.Dispatched.Contains(ShadowInputAction.ResetDemo), "reset must not fire after abort");
        }

        [Test] public void BareConfirm_WithNothingPending_IsNoop()
        {
            var sink = new RecordingSink();
            var r = new ShadowInputRouter(sink);
            r.Submit(ShadowInputAction.Confirm);
            Assert.AreEqual(0, sink.Dispatched.Count);
        }

        [Test] public void NonDestructiveActions_DispatchImmediately()
        {
            var sink = new RecordingSink();
            var r = new ShadowInputRouter(sink);
            r.Submit(ShadowInputAction.NextStep);
            r.Submit(ShadowInputAction.Recenter);
            Assert.AreEqual(2, sink.Dispatched.Count);
        }

        [Test] public void CapabilityReport_IsEvidenceFreeAndNamesUnsupported()
        {
            var p = ShadowDeviceCapabilityDetector.Detect(new MockProbe { _android = true });
            var text = ShadowDeviceCapabilityReport.ToText(p, "2026-07-21T00:00:00Z", "6000.0.23f1");
            StringAssert.Contains("OFFICIALLY UNSUPPORTED", text);
            StringAssert.Contains("device_validated: NO", text);
            var json = ShadowDeviceCapabilityReport.ToJson(p, "2026-07-21T00:00:00Z");
            StringAssert.Contains("\"level\":\"AndroidMock\"", json);
        }
    }
}
#endif
