// apps/shadow-lens/unity/Assets/ShadowLens/VoiceV2/IShadowTtsProvider.cs
// Provider-independent TTS seam. Android system TTS is the OFFLINE baseline; a cloud provider is
// optional, opt-in, disabled by default, and must never receive evidence without permission. The
// interface reports real capability (installed voice, offline availability, SSML) so nothing is
// assumed. Adapters render SSML from the validated spoken contract; the base build ships fixture +
// Android only, no keys. SOURCE AUTHORED.
using System;
using System.Collections.Generic;

namespace ShadowLens.VoiceV2
{
    public sealed class ShadowTtsCapabilityReport
    {
        public string ProviderId;
        public bool Initialized, OfflineAvailable, RequiresNetwork, SupportsSsml, SupportsSynthToFile, SupportsStreaming;
        public List<string> Locales = new List<string>();
        public string SelectedVoice, EngineId, PrivacyLabel = "on-device";
    }

    public interface IShadowTtsProvider
    {
        string ProviderId { get; }
        bool Initialize();
        ShadowTtsCapabilityReport Capability();
        void Speak(SpokenUtterance utterance, string utteranceId, Action<string> onStart, Action<string> onDone, Action<string, string> onError);
        void Stop();                 // barge-in: cancel current + queued
        void Dispose();
    }

    // Fixture provider: never produces audio; records what WOULD be spoken (for EditMode + evaluation).
    // Deterministic, offline, no network — safe default in tests and when no engine is present.
    public sealed class ShadowFixtureTtsProvider : IShadowTtsProvider
    {
        public readonly List<string> Spoken = new List<string>();
        public string ProviderId => "fixture";
        public bool Initialize() => true;
        public ShadowTtsCapabilityReport Capability() => new ShadowTtsCapabilityReport { ProviderId = ProviderId, Initialized = true, OfflineAvailable = true, RequiresNetwork = false, SupportsSsml = false, SupportsSynthToFile = false, SupportsStreaming = false, SelectedVoice = "fixture", EngineId = "fixture", PrivacyLabel = "on-device (no audio)" };
        public void Speak(SpokenUtterance u, string id, Action<string> onStart, Action<string> onDone, Action<string, string> onError)
        {
            ShadowVoiceContract.Validate(u);
            onStart?.Invoke(id);
            foreach (var s in u.Segments) Spoken.Add(s.Text);
            onDone?.Invoke(id);
        }
        public void Stop() { }
        public void Dispose() { Spoken.Clear(); }
    }

    // Routes to the first initialized provider by preference; always keeps the offline fixture as a
    // final fallback so a missing engine / a failed cloud provider degrades honestly (never silent).
    public sealed class ShadowTtsProviderRouter
    {
        readonly List<IShadowTtsProvider> _chain = new List<IShadowTtsProvider>();
        public IShadowTtsProvider Active { get; private set; }

        public ShadowTtsProviderRouter(params IShadowTtsProvider[] preference)
        {
            foreach (var p in preference) if (p != null) _chain.Add(p);
            _chain.Add(new ShadowFixtureTtsProvider());  // guaranteed offline fallback
        }

        public IShadowTtsProvider Resolve()
        {
            foreach (var p in _chain)
            {
                try { if (p.Initialize()) { Active = p; return p; } } catch { /* try next */ }
            }
            Active = _chain[_chain.Count - 1];
            return Active;
        }
    }
}
