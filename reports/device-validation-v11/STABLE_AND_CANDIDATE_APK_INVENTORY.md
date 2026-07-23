# Stable + candidate APK inventory

## Stable APK (PRESERVED — do NOT overwrite / rename / modify)
| Field | Value |
|---|---|
| Path | `apps/shadow-lens/unity/Build/Android/shadow-lens-xreal-voice-v10-core.apk` |
| Filename | shadow-lens-xreal-voice-v10-core.apk |
| Package ID | com.shadowlens.xrealvoice |
| versionName | 0.10-xreal-core |
| Size | 128140499 bytes |
| SHA-256 | 9efadf0af13fa6feef6e6470e448b4f4c6d6b062ecbc5b4e39f78b4b7b025d4e |
| Built with | XREAL SDK (SHADOW_XREAL_SDK), camera OFF, IL2CPP/ARM64, minSdk 29 |

Other historical candidates in Build/Android (also preserved):
- shadow-lens-guided-story-v5-candidate.apk — 3994e461a04f08d5… — 24628460 bytes
- shadow-lens-voice-v7-candidate.apk — d3b7767cbd00ae10… — 24664704 bytes
- shadow-lens-voice-v8-base.apk — 5097f8f52b738725… — 24673100 bytes
- shadow-lens-xreal-voice-v8-candidate.apk — 78f2d62e8c1f3964… — 134926402 bytes

## Planned V11 Beam Pro candidate (distinct file — never overwrites the stable)
| Field | Value |
|---|---|
| Filename | shadow-lens-v11-beampro-candidate-01.apk |
| versionName | 0.11-beampro-candidate.1 |
| versionCode | > prior candidate |
| Package ID | com.shadowlens.xrealvoice (kept — XREAL loader depends on it) |
| Scene | AuditWorkspace device bootstrap (default) + PrimitiveDiagnostic preserved |
| Camera | SHADOW_XREAL_CAMERA OFF (first candidate) |
| Build script | Shadow Lens/Build V11 Beam Pro Candidate (ShadowV11BeamProCandidate) |

## BUILD BLOCKER (honest)
The XREAL candidate build requires the official XREAL SDK imported (`SHADOW_XREAL_SDK` define).
Current project define symbols are EMPTY (`scriptingDefineSymbols: {}`) — the SDK is NOT imported
(SDK archives are not committed to git). So the candidate CANNOT be built in this automated
environment until the SDK is re-imported. See docs/UNITY_XREAL_BUILD_RUNBOOK.md. Also: no Android
device is attached to this machine (`adb devices` empty), so install/logcat/soak cannot run here.
