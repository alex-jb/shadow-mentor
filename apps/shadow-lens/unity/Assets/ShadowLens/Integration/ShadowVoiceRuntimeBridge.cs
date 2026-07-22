// apps/shadow-lens/unity/Assets/ShadowLens/Integration/ShadowVoiceRuntimeBridge.cs
// The single authoritative mapping from device/lifecycle/story state → voice behavior. The voice
// runtime does NOT re-implement device concepts; it consumes them here:
//   TRACKING_LOST  → interrupt P3 narration + speak a short P0 warning + preserve story state
//   TRACKING_LIMITED → speak a P1 note (does not interrupt an evidence quote)
//   APP_PAUSED     → stop TTS + discard obsolete narration
//   LANGUAGE_CHANGED → cancel old-language utterances, keep only the new locale
//   DEVICE_VALIDATION_PENDING → never speak "device validated" (stable phrase says pending)
// Pure C# (uses ShadowLens.Device enums + ShadowLens.VoiceV2 queue), EditMode-tested. SOURCE AUTHORED.
using ShadowLens.Device;
using ShadowLens.VoiceV2;

namespace ShadowLens.Integration
{
    public sealed class ShadowVoiceRuntimeBridge
    {
        readonly ShadowVoiceQueue _queue;
        public string Locale = "en-US";
        public ShadowVoiceRuntimeBridge(ShadowVoiceQueue queue) { _queue = queue; }
        public ShadowVoiceQueue Queue => _queue;

        // Tracking health transition from the device layer.
        public void OnTrackingHealth(ShadowTrackingHealth health)
        {
            switch (health)
            {
                case ShadowTrackingHealth.Lost:
                    _queue.Enqueue(ShadowVoiceStablePhrases.TrackingLost(Locale)); // P0 → interrupts P3 narration; a quote is only interrupted by P0
                    break;
                case ShadowTrackingHealth.Limited:
                    _queue.Enqueue(ShadowVoiceStablePhrases.TrackingLimited(Locale)); // P1
                    break;
                default:
                    break; // Nominal: nothing to say
            }
        }

        // App lifecycle: pause stops speech + discards obsolete narration; resume does NOT replay it.
        public void OnAppPause(bool paused) { if (paused) _queue.OnPause(); }

        // Language switch: cancel the old-language queue; the planner rebuilds only still-relevant speech.
        public void OnLanguageChanged(string newLocale) { Locale = newLocale; _queue.ClearLocaleExcept(newLocale); }

        // Session/capability state → a status line. DEVICE_VALIDATION_PENDING never speaks as validated.
        public void OnSessionState(ShadowSessionState state)
        {
            if (state == ShadowSessionState.DeviceValidationPending)
                _queue.Enqueue(ShadowVoiceStablePhrases.DeviceValidationPending(Locale));
            else if (state == ShadowSessionState.CameraUnavailable)
                _queue.Enqueue(ShadowVoiceStablePhrases.CameraUnavailable(Locale));
        }

        // Reset / story change clears stale speech.
        public void OnReset() { _queue.StopAll(); _queue.Enqueue(ShadowVoiceStablePhrases.ReturningToBanking(Locale)); }

        // A guard the whole runtime honors: an utterance may only be marked DEVICE when device evidence
        // exists. Until then it stays FIXTURE/DEVICE-PENDING — no utterance ever claims validation.
        public static bool MayClaimDeviceValidated(ShadowDeviceCapabilityProfile profile)
            => profile != null && profile.Has(ShadowCapability.DEVICE_VALIDATED);
    }
}
