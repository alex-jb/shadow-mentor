# Shadow XREAL + Voice device integration (Phase 8)

One authoritative mapping — the voice runtime CONSUMES device state, it does not re-model it.
`ShadowVoiceRuntimeBridge` (Assets/ShadowLens/Integration/) is the single seam.

| Device / lifecycle event | Voice behavior | Guarantee |
|---|---|---|
| `TRACKING_LOST` | interrupt P3 narration → speak a short **P0** tracking-lost line → story state preserved | only P0 interrupts a verbatim quote |
| `TRACKING_LIMITED` | speak a **P1** note | does NOT interrupt an in-progress evidence quote |
| `APP_PAUSED` | stop TTS + discard obsolete narration (`OnPause`) | resume never replays obsolete utterances |
| `LANGUAGE_CHANGED` | cancel old-language utterances (`ClearLocaleExcept`) | planner rebuilds only still-relevant speech |
| `DEVICE_VALIDATION_PENDING` | speak the "pending" line | it NEVER says "device validated" |
| `CAMERA_UNAVAILABLE` | speak the camera-unavailable line | no capture is claimed |
| `RESET` | clear speech + "Returning to Banking" | deterministic safe state |

Shared types are reused, not duplicated: `VoicePriority` (P0–P4) drives the queue; `ShadowTrackingHealth`
/ `ShadowSessionState` / `ShadowCapability` come from the Device layer; locale is en-US/zh-CN; the
fixture/live/device label is the same enum used everywhere. `MayClaimDeviceValidated()` returns true
only when `ShadowCapability.DEVICE_VALIDATED` is set — so no utterance can assert validation without
real device evidence. Verified by EditMode `ShadowVoiceIntegrationEditTests` (16/16 with voice) +
Node parity `test/shadow-voice-integration-parity.test.js`.
