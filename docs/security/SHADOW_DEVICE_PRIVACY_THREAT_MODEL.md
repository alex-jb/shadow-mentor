# Shadow device privacy threat model (V5)

Scope: the guided-story candidate on Android / XREAL. Fixtures only — no customer data. This model
guides the capture-retention policy and the device path. No production compliance claim.

## Assets
- Guided-story semantic data (fixture; public).
- (XREAL path only) RGB camera frames + OCR output — sensitive if real capture is ever enabled.
- Diagnostic logs (state transitions).

## Actors / surfaces
- On-device app (Unity IL2CPP).
- Beam Pro host + glasses.
- adb / logcat during testing.
- Exported diagnostics files.

## Threats and mitigations
| Threat | Mitigation | Status |
|---|---|---|
| Camera frame leakage | No camera in the base candidate; the XREAL path claims capture only after a non-black frame; frames hashed + retention-bounded (see retention policy) | base: N/A; XREAL: designed |
| Evidence content in logs | Diagnostics record STATE transitions only; a sanitizer caps length + strips quotes/newlines | ✅ implemented (`ShadowTrackingDiagnostics`, `ShadowInputDiagnostics`) |
| Fixture mistaken for live/real record | Provenance mode `FIXTURE` + persistent banner + labels | ✅ implemented |
| Over-broad permissions | Least privilege; only unused INTERNET remains (documented strip) | ⚠️ documented |
| Untrusted story JSON (injection / pollution / oversize) | Fail-closed loader: caps, closed enums, `__proto__` rejection, text-safe render | ✅ implemented + tested |
| Semantic hash misread as a trust/compliance verdict | Hash is integrity/parity only; UI never elevates it to a verdict; `ANALYTICAL_CORRECTNESS` stays `NOT_EVALUATED` | ✅ implemented |
| adb/logcat exposure during testing | Test package captures only Unity/ShadowLens/runtime-error tags; evidence never printed | ✅ implemented (`collect-logcat.sh`) |
| Backup exfiltration | No user data stored; recommend `allowBackup=false` for production | ⚠️ recommended |
| Overclaiming device capability | Capability detector fails closed; officially-unsupported features never exposed | ✅ implemented + tested |

## Out of scope (V5)
Production signing, keystore management, MDM, and any real customer data. Camera/OCR is architecture +
fixture tests only until device evidence exists.
