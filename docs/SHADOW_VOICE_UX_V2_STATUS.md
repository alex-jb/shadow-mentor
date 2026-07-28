# Shadow Voice UX V2 — honest status

Branch `feat/shadow-voice-ux-v7` (from `feat/shadow-xreal-native-v6 @ 851bb4b`). Never merged to main.
Stable APK `93f2a81a…` untouched. No production secrets, no cloud TTS by default, no person cloned.

## What shipped (verified, non-device)

- **Audit + style guide + provider matrix** (`docs/`, `docs/research/`): current TTS is a bare
  `Speak(string)` with no planner/queue/prosody — text (incl. Markdown/status) goes straight to the
  engine. That is the root cause; V2 inserts a spoken-language layer.
- **Provider-independent pipeline** (`lib/voice/*.mjs`, Node-tested): planner (evidence-first,
  progressive disclosure, bilingual, semantic-preserving) → pronunciation lexicon → deterministic
  prosody → `shadow-spoken-utterance-v1` (SSML-free, untrusted-safe) → safe voice router → priority
  queue + barge-in. **12 Node tests** + **2 parity tests**.
- **Unity mirror** (`Assets/ShadowLens/VoiceV2/*`, `Providers/ShadowAndroidTtsProvider.cs`):
  contract/prosody/router/queue + TTS provider abstraction (offline fixture fallback; Android system
  TTS via the official API, device-guarded; AndroidJavaObject isolated in the AndroidBridge assembly).
  **EditMode 7/7**.
- **Real comparison audio** (macOS `say`, desktop FIXTURE, labelled — never Beam Pro): en 40.3s→10.5s
  (**−74%**), zh 55.2s→12.9s (**−77%**). Comparison page browser-accepted (Chromium 149, 0
  external/CSP/error, no autoplay). Audio audit tool: 8 assets, 0 clipping.
- **TTS-only Android candidate** (`com.shadowlens.voice`): RELEASE, ARM64/IL2CPP, 24.66 MB — **no
  INTERNET/microphone/camera/storage** (least-privilege audit).
- Node suite **1,925 total · 1,922 passed · 3 skipped · 0 failed**. forbidden-phrases clean.

## Honest status ladder (§21)

| Status | State | Evidence |
|---|---|---|
| VOICE-AUDIT-COMPLETE | ✅ | docs/research/SHADOW_CURRENT_VOICE_AUDIT.md |
| VOICE-STYLE-GUIDE-AUTHORED | ✅ | docs/SHADOW_VOICE_STYLE_GUIDE.md |
| SPOKEN-CONTRACT-AUTHORED | ✅ | schema + docs |
| SPEECH-PLANNER-HOST-TESTED | ✅ | Node semantic-preservation tests |
| PROSODY-PLANNER-HOST-TESTED | ✅ | Node + Unity determinism tests |
| PRONUNCIATION-LEXICON-TESTED | ✅ | Node lexicon/normalizer tests |
| VOICE-QUEUE-TESTED | ✅ | Node + Unity priority/barge-in tests |
| BARGE-IN-HOST-TESTED | ✅ | queue interruption tests |
| VOICE-ACTION-SAFETY-TESTED | ✅ | Node + Unity: voice never authorizes; Reset needs non-voice confirm |
| ANDROID-TTS-ADAPTER-COMPILED | ✅ | ShadowAndroidTtsProvider compiles (AndroidBridge); native calls device-guarded |
| VOICE-COMPARISON-BROWSER-RENDERED | ✅ | Chromium 149 acceptance report |
| VOICE-COMPARISON-RECORDED | ✅ | comparison-demo.webm/.mp4 + 8 wav |
| ANDROID-VOICE-BUILT | ✅ | com.shadowlens.voice, TTS-only least-privilege |
| ANDROID-VOICE-INSTALLED | ❌ | no device |
| BEAM-PRO-TTS-VALIDATED | ❌ | no device (Beam Pro voice quality is not assumed) |
| ENGLISH-NATURALNESS-USER-TESTED | ❌ | protocol only; no listeners |
| CHINESE-NATURALNESS-USER-TESTED | ❌ | protocol only; no listeners |
| CLOUD-TTS-VALIDATED | ❌ | opt-in only; not enabled/validated |
| PRODUCTION-VOICE-APPROVED | ❌ | pre-1.0 |

## Blocked by (separately)

- **Device (Beam Pro / Android):** ANDROID-VOICE-INSTALLED, BEAM-PRO-TTS-VALIDATED — run
  `device-test/v6` + a TTS validation pass on hardware; detect the real installed engine/voice.
- **Listeners + approval:** ENGLISH/CHINESE-NATURALNESS-USER-TESTED — the study protocol is in
  `voice/evaluation/`; no naturalness improvement is claimed without it.
- **Explicit opt-in + privacy review:** CLOUD-TTS-VALIDATED — disabled by default; no evidence is
  sent off-device; no keys committed.

The measured wins (−74% / −77% shorter, semantic-preserving, deterministic prosody, working barge-in)
are **engineering** evidence. Perceived naturalness is a listener question, not claimed here.
