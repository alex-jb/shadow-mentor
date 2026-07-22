# Guided Story Android Candidate — permission audit (least privilege)

RELEASE build. `aapt dump permissions`. Accessed 2026-07-21.

| Permission | Present | Needed by base candidate? | Verdict |
|---|---|---|---|
| `android.permission.INTERNET` | yes | **no** | ⚠️ Unity Android default (Auto). Base candidate makes no requests; strip with a custom manifest `tools:node="remove"` for production. |
| `…DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | yes | Unity internal | ✅ self-scoped Android 13+ receiver requirement; benign |
| `android.permission.CAMERA` | **no** | no | ✅ correct — no camera in base candidate |
| `android.permission.RECORD_AUDIO` | **no** | no | ✅ correct — added only in the XREAL RGB-recording candidate |
| `FOREGROUND_SERVICE_MEDIA_PROJECTION` | **no** | no | ✅ correct — XREAL recording candidate only |
| storage (READ/WRITE_EXTERNAL) | **no** | no | ✅ least privilege |
| location | **no** | no | ✅ least privilege |

## Principle

The base guided-story candidate follows least privilege: **no camera, microphone, storage, or
location**. The only real over-declaration is `INTERNET` (Unity default), which the app does not use —
documented with a strip recommendation. Camera/microphone permissions must be added **only** when the
real XREAL Eye candidate is built and RGB recording is actually enabled, per official XREAL docs
(`RECORD_AUDIO` + `FOREGROUND_SERVICE_MEDIA_PROJECTION`); raw `CAMERA` access is officially
undocumented for XREAL and stays fail-closed until proven on device.
