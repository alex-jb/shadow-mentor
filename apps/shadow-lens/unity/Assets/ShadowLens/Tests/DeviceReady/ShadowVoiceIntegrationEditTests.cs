// apps/shadow-lens/unity/Assets/ShadowLens/Tests/DeviceReady/ShadowVoiceIntegrationEditTests.cs
// EditMode tests for the XREAL+Voice integration: the runtime bridge maps device events to voice
// behavior (tracking-lost P0 interrupts narration; app-pause discards; language-switch clears old
// locale; device-validation-pending never speaks "validated"), device presets tune EN/ZH separately
// and Beam Pro stays unmeasured, and the two voice modes gate the microphone. SOURCE AUTHORED.
#if UNITY_INCLUDE_TESTS
using NUnit.Framework;
using ShadowLens.Device;
using ShadowLens.VoiceV2;
using ShadowLens.Integration;

namespace ShadowLens.Tests
{
    public class ShadowVoiceIntegrationEditTests
    {
        static SpokenUtterance Narration(string id)
        {
            var u = new SpokenUtterance { UtteranceId = id, Locale = "en-US", Role = "SYSTEM_NARRATOR", Intent = "REPORT", ProsodyProfile = "SYSTEM_NEUTRAL", Priority = VoicePriority.P3 };
            u.Segments.Add(new SpokenSegment { SegmentId = "s", Text = "Guided narration.", SemanticRole = "prompt" });
            return u;
        }

        [Test] public void TrackingLost_InterruptsP3Narration_WithAP0Warning_StoryPreserved()
        {
            var q = new ShadowVoiceQueue();
            var bridge = new ShadowVoiceRuntimeBridge(q);
            q.Enqueue(Narration("n1")); q.Next();
            Assert.AreEqual("n1", q.Current.UtteranceId);
            bridge.OnTrackingHealth(ShadowTrackingHealth.Lost);
            Assert.IsNull(q.Current, "P0 tracking-lost interrupted the P3 narration");
            var next = q.Next();
            Assert.AreEqual(VoicePriority.P0, next.Priority);
            Assert.AreEqual("tracking-lost", next.UtteranceId);
        }

        [Test] public void TrackingLimited_IsP1_DoesNotInterruptAVerbatimQuote()
        {
            var q = new ShadowVoiceQueue();
            var bridge = new ShadowVoiceRuntimeBridge(q);
            var quote = new SpokenUtterance { UtteranceId = "q", Locale = "en-US", Role = "EVIDENCE_READER", Intent = "QUOTE", ProsodyProfile = "EVIDENCE_READER", Priority = VoicePriority.P2 };
            quote.Segments.Add(new SpokenSegment { SegmentId = "qs", Text = "revolving utilization 78%", SemanticRole = "quote", IsVerbatimQuote = true });
            q.Enqueue(quote); q.Next(); q.CurrentActiveIsVerbatimQuote = true;
            bridge.OnTrackingHealth(ShadowTrackingHealth.Limited);
            Assert.AreEqual("q", q.Current.UtteranceId, "an ordinary P1 note does not interrupt a verbatim quote");
        }

        [Test] public void AppPause_DiscardsObsoleteNarration()
        {
            var q = new ShadowVoiceQueue();
            var bridge = new ShadowVoiceRuntimeBridge(q);
            q.Enqueue(Narration("n1")); q.Next();
            bridge.OnAppPause(true);
            Assert.IsNull(q.Current);
        }

        [Test] public void LanguageChanged_CancelsOldLocaleUtterances()
        {
            var q = new ShadowVoiceQueue();
            var bridge = new ShadowVoiceRuntimeBridge(q);
            q.Enqueue(Narration("en1"));
            var zh = Narration("zh1"); zh.Locale = "zh-CN"; q.Enqueue(zh);
            bridge.OnLanguageChanged("zh-CN");
            Assert.AreEqual("zh-CN", bridge.Locale);
            var next = q.Next();
            Assert.AreEqual("zh-CN", next.Locale, "only the new-locale utterance remains");
        }

        [Test] public void DeviceValidationPending_NeverSpeaksAsValidated()
        {
            var u = ShadowVoiceStablePhrases.DeviceValidationPending("en-US");
            foreach (var s in u.Segments) StringAssert.DoesNotContain("validated", s.Text.ToLowerInvariant());
            // and the bridge only permits a DEVICE claim when the capability is actually validated
            var pending = ShadowDeviceCapabilityDetector.Detect(null);
            Assert.IsFalse(ShadowVoiceRuntimeBridge.MayClaimDeviceValidated(pending));
        }

        [Test] public void Reset_ClearsSpeech_AndReturnsToBanking()
        {
            var q = new ShadowVoiceQueue();
            var bridge = new ShadowVoiceRuntimeBridge(q);
            q.Enqueue(Narration("n1")); q.Enqueue(Narration("n2")); q.Next();
            bridge.OnReset();
            var next = q.Next();
            Assert.AreEqual("returning-to-banking", next.UtteranceId);
        }

        [Test] public void Presets_TuneEnAndZhSeparately_BeamProStaysUnmeasured()
        {
            int n = 0; foreach (var p in ShadowVoiceDevicePresets.All()) n++;
            Assert.AreEqual(4, n);
            Assert.AreNotEqual(ShadowVoiceDevicePresets.AndroidEnUsV1.Rate, ShadowVoiceDevicePresets.AndroidZhCnV1.Rate, "EN/ZH tuned separately");
            Assert.IsFalse(ShadowVoiceDevicePresets.BeamProEnUsV1.Measured);
            Assert.IsFalse(ShadowVoiceDevicePresets.BeamProZhCnV1.Measured);
            Assert.AreEqual("(pending)", ShadowVoiceDevicePresets.BeamProEnUsV1.Device);
        }

        [Test] public void Modes_TtsOnlyNeedsNoMic_VoiceCommandsGateMicBehindExplicitOptIn()
        {
            Assert.IsFalse(ShadowVoiceModePolicy.RequiresMicrophone(ShadowVoiceMode.TTS_ONLY));
            Assert.IsTrue(ShadowVoiceModePolicy.RequiresMicrophone(ShadowVoiceMode.VOICE_COMMANDS_ENABLED));
            Assert.IsFalse(ShadowVoiceModePolicy.MayRequestMicNow(ShadowVoiceMode.VOICE_COMMANDS_ENABLED, userExplicitlyEnabled: false), "no mic request without explicit opt-in");
            Assert.IsTrue(ShadowVoiceModePolicy.MayRequestMicNow(ShadowVoiceMode.VOICE_COMMANDS_ENABLED, userExplicitlyEnabled: true));
        }

        [Test] public void Environment_PanelHasNoValidatedClaim_AndNamesMissingVoice()
        {
            var env = new ShadowVoiceEnvironment { SuitableVoiceAvailable = false };
            var panel = env.ToPanelText();
            StringAssert.Contains("VOICE ENVIRONMENT", panel);
            StringAssert.Contains("using fixture audio", panel);
            StringAssert.DoesNotContain("device validated", panel.ToLowerInvariant());
        }
    }
}
#endif
