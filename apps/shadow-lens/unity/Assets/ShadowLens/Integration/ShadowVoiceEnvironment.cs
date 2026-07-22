// apps/shadow-lens/unity/Assets/ShadowLens/Integration/ShadowVoiceEnvironment.cs
// The runtime "VOICE ENVIRONMENT" diagnostic model + in-app panel text. Fields are filled from the
// real Android TTS engine at runtime (engine package, voice, locale, offline flag, network-required),
// never assumed — Google Speech Services is NOT presumed installed, and voices are never silently
// downloaded. When no suitable voice exists the panel says so and the app keeps readable on-screen
// text + fixture audio; evidence verification is never blocked. Pure C#. SOURCE AUTHORED.
using System.Text;

namespace ShadowLens.Integration
{
    public sealed class ShadowVoiceEnvironment
    {
        public string EnginePackage = "(unknown)", EngineVersion = "(unknown)", VoiceName = "(none)", VoiceLocale = "(none)";
        public bool Offline, NetworkRequired, SsmlSupported, SynthToFileSupported, SuitableVoiceAvailable;
        public float SelectedRate = 1f, SelectedPitch = 1f;
        public string ProviderState = "(uninitialized)", QueueState = "(empty)", CurrentUtterance = "(none)", LastError = "(none)";

        // The panel the user sees on device. No secrets, no PII.
        public string ToPanelText()
        {
            var sb = new StringBuilder();
            sb.Append("VOICE ENVIRONMENT\n");
            sb.Append("Engine: ").Append(EnginePackage).Append(' ').Append(EngineVersion).Append('\n');
            sb.Append("Voice: ").Append(VoiceName).Append('\n');
            sb.Append("Locale: ").Append(VoiceLocale).Append('\n');
            sb.Append("Offline: ").Append(Offline ? "yes" : "no").Append('\n');
            sb.Append("Network required: ").Append(NetworkRequired ? "yes" : "no").Append('\n');
            sb.Append("Suitable voice: ").Append(SuitableVoiceAvailable ? "yes" : "NO — using fixture audio + on-screen text").Append('\n');
            sb.Append("Provider state: ").Append(ProviderState).Append('\n');
            sb.Append("Queue state: ").Append(QueueState).Append('\n');
            sb.Append("Current utterance: ").Append(CurrentUtterance).Append('\n');
            sb.Append("Last error: ").Append(LastError).Append('\n');
            return sb.ToString();
        }

        // Fill from a provider capability report (device runtime).
        public void FromCapability(ShadowLens.VoiceV2.ShadowTtsCapabilityReport cap)
        {
            if (cap == null) return;
            EnginePackage = cap.EngineId ?? EnginePackage;
            VoiceName = cap.SelectedVoice ?? VoiceName;
            Offline = cap.OfflineAvailable;
            NetworkRequired = cap.RequiresNetwork;
            SsmlSupported = cap.SupportsSsml;
            SynthToFileSupported = cap.SupportsSynthToFile;
            SuitableVoiceAvailable = cap.Initialized && cap.OfflineAvailable;
            ProviderState = cap.Initialized ? "initialized" : "unavailable";
        }
    }
}
