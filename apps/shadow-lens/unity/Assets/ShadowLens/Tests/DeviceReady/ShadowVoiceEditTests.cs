// apps/shadow-lens/unity/Assets/ShadowLens/Tests/DeviceReady/ShadowVoiceEditTests.cs
// EditMode tests for the Unity Voice V2 mirror: contract validation (untrusted-safe), deterministic
// prosody, safe voice routing (regulated actions need non-voice confirmation; voice never authorizes),
// priority queue + barge-in, and provider fallback to the offline fixture. SOURCE AUTHORED.
#if UNITY_INCLUDE_TESTS
using NUnit.Framework;
using ShadowLens.VoiceV2;

namespace ShadowLens.Tests
{
    public class ShadowVoiceEditTests
    {
        static SpokenUtterance Utt(string id, VoicePriority pri = VoicePriority.P3, string locale = "en-US")
        {
            var u = new SpokenUtterance { UtteranceId = id, Locale = locale, Role = "SYSTEM_NARRATOR", Intent = "REPORT", ProsodyProfile = "SYSTEM_NEUTRAL", Priority = pri };
            u.Segments.Add(new SpokenSegment { SegmentId = "s1", Text = "The first failure is sequence three.", SemanticRole = "result" });
            return u;
        }

        [Test] public void Contract_RejectsMarkupAndBadEnums()
        {
            Assert.Throws<ShadowVoiceValidationException>(() => ShadowVoiceContract.AssertPlainSpeech("<speak>x</speak>"));
            Assert.Throws<ShadowVoiceValidationException>(() => ShadowVoiceContract.AssertPlainSpeech("hello <script>"));
            var bad = Utt("x"); bad.Locale = "fr-FR";
            Assert.Throws<ShadowVoiceValidationException>(() => ShadowVoiceContract.Validate(bad));
            var dup = Utt("y"); dup.Segments.Add(new SpokenSegment { SegmentId = "s1", Text = "again", SemanticRole = "detail" });
            Assert.Throws<ShadowVoiceValidationException>(() => ShadowVoiceContract.Validate(dup));
        }

        [Test] public void Contract_DetectsForbiddenFiller()
        {
            Assert.IsNotEmpty(ShadowVoiceContract.FindForbiddenFiller("Certainly, based on my comprehensive analysis..."));
            Assert.IsEmpty(ShadowVoiceContract.FindForbiddenFiller("The first failure is sequence three."));
        }

        [Test] public void Prosody_IsDeterministic_QuoteUsesEvidenceRate_FailureIsModest()
        {
            var a = ShadowVoiceProsody.ForSegment("VERIFICATION_FAILURE", "result", true);
            var b = ShadowVoiceProsody.ForSegment("VERIFICATION_FAILURE", "result", true);
            Assert.AreEqual(a.Rate, b.Rate); Assert.AreEqual(a.PauseBeforeMs, b.PauseBeforeMs);
            Assert.LessOrEqual(a.Rate, 0.94f); Assert.AreEqual("mild", a.Emphasis);
            var q = ShadowVoiceProsody.ForSegment("SYSTEM_NEUTRAL", "quote");
            Assert.AreEqual(0.92f, q.Rate, 1e-4); Assert.IsFalse(q.CanInterruptAfter);
        }

        [Test] public void Router_NavigationDispatches_ResetNeedsNonVoiceConfirm_VoiceNeverAuthorizes()
        {
            var r = new ShadowVoiceRouter();
            Assert.AreEqual(VoiceAction.Next, r.Route("next").Action);
            Assert.IsTrue(r.Route("next").Dispatched);
            var reset = r.Route("reset the demo");
            Assert.AreEqual(VoiceAction.RequestReset, reset.Action);
            Assert.IsFalse(reset.Dispatched);
            Assert.IsTrue(reset.RequiresConfirmation);
            Assert.AreEqual(VoiceRouterState.ActionPending, r.State);
            Assert.AreEqual(VoiceAction.RequestReset, r.ConfirmByNonVoice());
            Assert.IsFalse(ShadowVoiceRouter.CanVoiceAuthorize());
            Assert.AreEqual(VoiceAction.None, r.Route("approve the loan").Action);
        }

        [Test] public void Queue_HigherPriorityInterrupts_QuoteProtected_DuplicatesSuppressed()
        {
            var q = new ShadowVoiceQueue();
            q.Enqueue(Utt("n1")); q.Next();
            Assert.AreEqual("n1", q.Current.UtteranceId);
            var res = q.Enqueue(Utt("t1", VoicePriority.P0));
            Assert.AreEqual("n1", res.Interrupted?.UtteranceId);

            var q2 = new ShadowVoiceQueue();
            q2.Enqueue(Utt("q1", VoicePriority.P2)); q2.Next(); q2.CurrentActiveIsVerbatimQuote = true;
            Assert.IsNull(q2.Enqueue(Utt("s1", VoicePriority.P2)).Interrupted, "ordinary status does not interrupt a quote");
            Assert.IsFalse(q2.Enqueue(q2.Current).Accepted, "duplicate suppressed");
        }

        [Test] public void Queue_ResetClears_LanguageSwitchCancelsOldLocale()
        {
            var q = new ShadowVoiceQueue();
            q.Enqueue(Utt("a", VoicePriority.P3, "en-US"));
            q.Enqueue(Utt("b", VoicePriority.P3, "zh-CN"));
            q.ClearLocaleExcept("zh-CN");
            Assert.IsTrue(q.StopAll());
            Assert.AreEqual(0, q.Length);
        }

        [Test] public void ProviderRouter_FallsBackToOfflineFixture()
        {
            var router = new ShadowTtsProviderRouter();   // no real providers → fixture fallback
            var p = router.Resolve();
            Assert.IsNotNull(p);
            Assert.AreEqual("fixture", p.ProviderId);
            var fix = (ShadowFixtureTtsProvider)p;
            string started = null, done = null;
            fix.Speak(Utt("u1"), "u1", s => started = s, s => done = s, (a, b) => { });
            Assert.AreEqual("u1", started); Assert.AreEqual("u1", done);
            Assert.IsNotEmpty(fix.Spoken);
        }
    }
}
#endif
