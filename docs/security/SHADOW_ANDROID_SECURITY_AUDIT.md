# Shadow Android security audit — guided-story candidate

Target: `shadow-lens-guided-story-v5-candidate.apk` (RELEASE build). Evidence:
`reports/device-ready-v5/`. Accessed 2026-07-21. No production compliance claim.

| Area | Finding | Verdict |
|---|---|---|
| debuggable | absent in release build | ✅ |
| architectures | arm64-v8a only (no 32-bit/x86) | ✅ |
| native libs | standard Unity IL2CPP set; no third-party/XREAL `.so` | ✅ |
| WebView | none | ✅ no WebView attack surface |
| exported components | only the required launcher activity; second activity `exported=false` | ✅ |
| INTERNET permission | declared (Unity default), unused by the base candidate | ⚠️ strip with `tools:node="remove"` for production |
| camera / mic / storage / location | none requested | ✅ least privilege |
| fixture vs live separation | provenance mode is `FIXTURE`; the banner + labels always say FIXTURE / DEVICE VALIDATION PENDING | ✅ no live/fixture confusion |
| story JSON handling | parsed by a fail-closed loader (caps + closed enums + `__proto__` rejection); text-safe | ✅ untrusted-input posture |
| semantic hash | used for integrity/parity only; never presented as a compliance/trust verdict | ✅ |
| secrets / keys | none in the APK; the fixture release-key fingerprint is FIXTURE only | ✅ |
| network calls | none in the base candidate | ✅ no-network mode works |
| diagnostics | evidence-free ring buffers (state transitions only; never story/camera content) | ✅ |
| path traversal / arbitrary URL | story references are opaque ids resolved by the adapter; no filesystem path or URL is taken from story JSON | ✅ |
| Android backups | default; the candidate stores no user data | ✅ (recommend `allowBackup=false` for production) |

## Recommendations before production
1. Strip the unused INTERNET permission (custom manifest `tools:node="remove"`).
2. Set `android:allowBackup="false"` once any local state exists.
3. Re-run this audit after the XREAL SDK candidate is built (new AAR → re-check permissions, exported
   components, duplicate classes, and the RGB-recording permissions per official XREAL docs).
4. Do NOT production-sign here — signing/keystore is an operator decision (out of scope for V5).
