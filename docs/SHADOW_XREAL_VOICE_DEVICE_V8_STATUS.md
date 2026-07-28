# Shadow XREAL + Voice device V8 — honest status

Branch `feat/shadow-xreal-voice-device-v8` (from `feat/shadow-voice-ux-v7 @ ec65721`, which already
contains all of `feat/shadow-xreal-native-v6` — v7 branched linearly from v6 HEAD, merge-base
confirmed). Never merged to main. Stable APK `93f2a81a…` untouched. No production signing, no cloud
TTS by default, no committed keys.

## What shipped (verified, non-device / non-SDK)

- **Branch integration**: v8 = v6 (device/XREAL loader model + evidence pipeline) + v7 (voice),
  linear, no conflicts.
- **Shared runtime bridge** (`Assets/ShadowLens/Integration/`): the single mapping from device/
  lifecycle/story state → voice behavior (TRACKING_LOST→P0 interrupt, LIMITED→P1, APP_PAUSED→discard,
  LANGUAGE_CHANGED→clear old locale, DEVICE_VALIDATION_PENDING→never "validated"). Stable-phrase
  factory, VOICE ENVIRONMENT diagnostic model, EN/ZH device presets (Beam Pro presets stay unmeasured),
  TTS_ONLY / VOICE_COMMANDS_ENABLED modes (mic only behind explicit opt-in). **EditMode 16/16** (with voice).
- **Base voice V8 candidate** (`com.shadowlens.voice.base`): RELEASE, ARM64/IL2CPP, 24.67 MB — no
  INTERNET/microphone/camera/storage (least-privilege audit).
- **XREAL+Voice V8 candidate**: build method authored + gated; it FAILS honestly without the XREAL SDK
  (not built as a placeholder). Requires the operator's SDK import (`docs/UNITY_XREAL_BUILD_RUNBOOK.md`).
- **Node**: failure-injection + integration-parity tests. Suite **1,935 total · 1,932 passed · 3
  skipped · 0 failed**. forbidden-phrases clean.
- **Docs/harness**: device integration map, tuning rules, internal-listening-evaluation protocol,
  `device-test/v8/` (TTS engine detection + device audio capture — device-only), `media/voice-v8/device/`
  (empty until a device day; desktop `say` fixtures stay in `media/voice-v7/`).

## Honest status ladder (§16)

| Status | State | Evidence |
|---|---|---|
| XREAL-VOICE-BRANCH-INTEGRATED | ✅ | v8 = v6+v7 linear; integration bridge + EditMode 16/16 |
| BASE-VOICE-APK-BUILT | ✅ | com.shadowlens.voice.base, TTS-only least-privilege |
| XREAL-VOICE-APK-BUILT | ❌ | requires the XREAL SDK import (build fails honestly without it) |
| ANDROID-VOICE-INSTALLED | ❌ | no device |
| TTS-ENGINE-DETECTED | ❌ | needs a device (VOICE ENVIRONMENT panel + detect-tts-engine.sh) |
| ENGLISH-DEVICE-TTS-VALIDATED | ❌ | no device |
| CHINESE-DEVICE-TTS-VALIDATED | ❌ | no device |
| AUDIO-FOCUS-VALIDATED | ❌ | no device (focus manager is device-gated) |
| BARGE-IN-DEVICE-VALIDATED | ⚠️ host only | queue interruption host-tested; device latency unmeasured |
| TRACKING-VOICE-INTERRUPTION-VALIDATED | ⚠️ host only | bridge maps + EditMode-tested; device timing unmeasured |
| VOICE-COMMANDS-DEVICE-VALIDATED | ❌ | no device; recognition mode is opt-in only |
| ANDROID-VOICE-MEDIA-CAPTURED | ❌ | no device (macOS say fixtures are separate, labelled) |
| BEAM-PRO-VOICE-VALIDATED | ❌ | no device |
| INTERNAL-LISTENING-EVALUATED | ❌ | protocol only; no listeners |
| FORMAL-USER-STUDIED | ❌ | not run |
| CLOUD-TTS-VALIDATED | ❌ | opt-in only; disabled by default |
| PRODUCTION-VOICE-APPROVED | ❌ | pre-1.0 |

## Blocked by (separately)

- **XREAL SDK import (operator):** XREAL-VOICE-APK-BUILT + all XREAL-runtime validation.
- **Beam Pro / Android hardware:** every *-DEVICE-VALIDATED / installed / engine-detected /
  media-captured status. Run `device-test/v8/FIRST…` + the v6 device runbook, then this v8 harness.
- **Listeners + approval:** INTERNAL-LISTENING-EVALUATED, FORMAL-USER-STUDIED.
- **Explicit opt-in + privacy review:** CLOUD-TTS-VALIDATED.

Host tests prove the integration wiring, semantic preservation, and safe interruption LOGIC. Device
timing/latency, real engine behavior, and human preference are NOT inferred from host tests.
