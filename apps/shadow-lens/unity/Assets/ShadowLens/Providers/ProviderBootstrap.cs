// apps/shadow-lens/unity/Assets/ShadowLens/Providers/ProviderBootstrap.cs
// Compile isolation: the project MUST compile in mock/editor mode WITHOUT the proprietary
// XREAL SDK package and WITHOUT the Android bridges. The real adapters live behind the
// SHADOW_XREAL_SDK define and platform guards; when they're absent, mocks are used and the
// status string says exactly what is missing (never a silent fallback that looks real).
//
// SOURCE AUTHORED · BUILD CONFIGURED · NOT COMPILED (no Unity on the build host) ·
// DEVICE VALIDATION PENDING.
using ShadowLens.Core;

namespace ShadowLens.Providers
{
    public struct ProviderSet
    {
        public ITrackingProvider Tracking;
        public IStillCaptureProvider Capture;
        public IOcrProvider Ocr;
        public IVoiceRecognitionProvider Voice;
        public ITextToSpeechProvider Tts;
        public string Status;       // human-readable, shown in the diagnostics panel
        public bool IsMock;
    }

    public static class ProviderBootstrap
    {
        public static ProviderSet Resolve()
        {
            var set = new ProviderSet();

#if SHADOW_XREAL_SDK && UNITY_ANDROID && !UNITY_EDITOR
            set.Tracking = new XrealTrackingProvider();
            set.Capture  = new XrealRgbFrameProvider();
            set.Status   = "XREAL SDK + Eye adapters active (device path)";
            set.IsMock   = false;
#elif UNITY_ANDROID && !UNITY_EDITOR
            // On-device Android but the proprietary XREAL SDK package is NOT installed.
            set.Tracking = new Core.MockTrackingProvider();
            set.Capture  = new Core.MockFrameProvider();
            set.Status   = "XREAL SDK NOT INSTALLED — tracking/capture are MOCK (add the package + define SHADOW_XREAL_SDK)";
            set.IsMock   = true;
#else
            // Editor / desktop — always mock so the app runs with no hardware.
            set.Tracking = new Core.MockTrackingProvider();
            set.Capture  = new Core.MockFrameProvider();
            set.Status   = "Editor mock providers (no device)";
            set.IsMock   = true;
#endif

#if UNITY_ANDROID && !UNITY_EDITOR
            set.Ocr   = new AndroidOcrProvider();     // ML Kit AAR bridge (platform-guarded)
            set.Voice = new AndroidVoiceProvider();   // SpeechRecognizer AAR bridge
            set.Tts   = new AndroidTtsProvider();
#else
            set.Ocr   = new Core.MockOcrProvider();
            set.Voice = new MockVoiceProvider();
            set.Tts   = new MockTtsProvider();
#endif
            return set;
        }
    }

    // Mocks live outside any platform guard so they ALWAYS compile.
    public class MockVoiceProvider : IVoiceRecognitionProvider
    {
        public bool OnDeviceAvailable => false;
        public void StartPushToTalk(System.Action<string, float> onFinal) => onFinal?.Invoke("analyze", 1f);
        public void Stop() { }
        public void Dispose() { }
    }
    public class MockTtsProvider : ITextToSpeechProvider { public void Speak(string t) { } public void Stop() { } }
}
