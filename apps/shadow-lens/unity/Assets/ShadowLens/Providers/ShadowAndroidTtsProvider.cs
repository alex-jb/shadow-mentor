// apps/shadow-lens/unity/Assets/ShadowLens/Providers/ShadowAndroidTtsProvider.cs
// Android system TextToSpeech adapter — the OFFLINE baseline. Lives in the isolated AndroidBridge
// assembly because it uses AndroidJavaObject (the project rule: JNI interop stays out of the core
// ShadowLens assembly). Uses the official public Android API (android.speech.tts.TextToSpeech:
// speak(text, QUEUE_FLUSH, params, utteranceId), setSpeechRate, stop, shutdown). Native calls are
// guarded to Android device builds; in Editor/desktop it reports offline-unavailable and the router
// falls back to the fixture provider. Implements ShadowLens.VoiceV2.IShadowTtsProvider. SOURCE
// AUTHORED — device execution validated separately.
#if UNITY_2020_1_OR_NEWER
using System;
using UnityEngine;
using ShadowLens.VoiceV2;

namespace ShadowLens.Providers
{
    public sealed class ShadowAndroidTtsProvider : IShadowTtsProvider
    {
        public string ProviderId => "android-system-tts";
        bool _ready;
#if UNITY_ANDROID && !UNITY_EDITOR
        AndroidJavaObject _tts;
#endif

        public bool Initialize()
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            try
            {
                using (var up = new AndroidJavaClass("com.unity3d.player.UnityPlayer"))
                using (var activity = up.GetStatic<AndroidJavaObject>("currentActivity"))
                {
                    _tts = new AndroidJavaObject("android.speech.tts.TextToSpeech", activity, (AndroidJavaObject)null);
                    _ready = _tts != null;
                }
            }
            catch (Exception e) { Debug.LogWarning("[AndroidTts] init failed: " + e.Message); _ready = false; }
            return _ready;
#else
            _ready = false;   // not an Android device build → router uses fixture
            return false;
#endif
        }

        public ShadowTtsCapabilityReport Capability() => new ShadowTtsCapabilityReport
        {
            ProviderId = ProviderId, Initialized = _ready, OfflineAvailable = _ready, RequiresNetwork = false,
            SupportsSsml = false, SupportsSynthToFile = true, SupportsStreaming = false,
            SelectedVoice = _ready ? "device-default (detected at runtime)" : "(none)",
            EngineId = "android.speech.tts.TextToSpeech", PrivacyLabel = "on-device",
        };

        public void Speak(SpokenUtterance u, string utteranceId, Action<string> onStart, Action<string> onDone, Action<string, string> onError)
        {
            ShadowVoiceContract.Validate(u);   // untrusted-safe before reaching the engine
#if UNITY_ANDROID && !UNITY_EDITOR
            if (!_ready || _tts == null) { onError?.Invoke(utteranceId, "android tts not ready"); return; }
            try
            {
                onStart?.Invoke(utteranceId);
                bool first = true;
                foreach (var s in u.Segments)
                {
                    _tts.Call<int>("setSpeechRate", s.RateMultiplier);
                    _tts.Call<int>("speak", s.Text, first ? 0 : 1, null, utteranceId + ":" + s.SegmentId); // QUEUE_FLUSH then QUEUE_ADD
                    first = false;
                }
                onDone?.Invoke(utteranceId);
            }
            catch (Exception e) { onError?.Invoke(utteranceId, e.Message); }
#else
            onError?.Invoke(utteranceId, "android tts unavailable off-device");
#endif
        }

        public void Stop()
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            try { _tts?.Call<int>("stop"); } catch { }
#endif
        }

        public void Dispose()
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            try { _tts?.Call("shutdown"); _tts?.Dispose(); _tts = null; } catch { }
#endif
            _ready = false;
        }
    }
}
#endif
