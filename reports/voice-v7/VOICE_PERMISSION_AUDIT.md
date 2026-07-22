# Voice V2 candidate — permission audit

APK: `Build/Android/shadow-lens-voice-v7-candidate.apk` (release). sha256 `d3b7767cbd00ae10ca325670c1992830a07081e3e805bc9279d603f682cee769`. 2026-07-21.

TTS-only mode. Declared permissions: only Unity's internal `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`.

| Permission | Present | Verdict |
|---|---|---|
| INTERNET | no | ✅ stripped (custom manifest); TTS is offline |
| RECORD_AUDIO (microphone) | no | ✅ TTS-only; speech recognition is a separate, not-built mode |
| CAMERA | no | ✅ |
| storage / location | no | ✅ least privilege |

ARM64 · IL2CPP · non-debuggable · min 24 / target 34. Status: **ANDROID-VOICE-BUILT** (not
BEAM-PRO-TTS-VALIDATED — that needs the device). A speech-recognition build would add RECORD_AUDIO
only when explicitly enabled; a cloud-TTS build would add INTERNET only in a separate labelled config.
