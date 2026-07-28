# Shadow Voice UX V2 research (official/primary)

| Topic | Fact | Source | Accessed | Implication |
|---|---|---|---|---|
| Android TextToSpeech | `speak()` with QUEUE_ADD / QUEUE_FLUSH; `synthesizeToFile`; `setSpeechRate`/`setPitch`; per-utterance `KEY_PARAM_UTTERANCE_ID` | https://developer.android.com/reference/android/speech/tts/TextToSpeech | 2026-07-21 | The adapter must pass utterance ids + use QUEUE_FLUSH for barge-in; rate/pitch are coarse — prosody must be planned as segments+pauses, not just a global rate. |
| UtteranceProgressListener | onStart/onDone/onError/onStop per utterance id | https://developer.android.com/reference/android/speech/tts/UtteranceProgressListener | 2026-07-21 | Wire progress → queue advance + latency metrics; onStop confirms barge-in cancel. |
| Audio focus | AudioManager.requestAudioFocus / abandon; transient focus for short prompts | https://developer.android.com/media/optimize/audio-focus | 2026-07-21 | The turn manager must request focus before speaking, release after; pause on focus loss. |
| SpeechRecognizer | on-device recognition intent; RECORD_AUDIO permission | https://developer.android.com/reference/android/speech/SpeechRecognizer | 2026-07-21 | Microphone permission is requested ONLY when recognition is enabled; TTS-only mode requests none. |
| W3C SSML 1.1 | say-as, sub, phoneme, prosody, break | https://www.w3.org/TR/speech-synthesis11/ | 2026-07-21 | Provider adapters generate SSML from validated segments; the canonical contract stays SSML-free (untrusted-safe). |
| Unity audio | AudioSource.Play/Stop; OnApplicationPause | https://docs.unity3d.com/6000.0/Documentation/Manual/class-AudioSource.html | 2026-07-21 | Fixture/earcon playback + pause/resume handled at the Unity layer. |
| Beam Pro audio | no Shadow-specific official doc for TTS quality | (none) | 2026-07-21 | Do NOT assume Beam Pro voice quality matches another Android device; validate on hardware. |
