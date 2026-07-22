# Shadow current voice audit (Phase 7 §1)

Inspected the repo directly. Findings:

| Item | Current state |
|---|---|
| TTS interface | `Core/IProviders.cs` → `ITextToSpeechProvider { void Speak(string); void Stop(); }` — minimal: one string in, no locale, no SSML, no prosody, no utterance id, no progress, no queue. |
| Speech recognition | `IVoiceRecognitionProvider` (push-to-talk, on-device flag) — separate from TTS. |
| Bundled TTS AAR | none found. |
| Android TTS bridge | `Providers/AndroidBridgeProviders.cs` + `ProviderBootstrap.cs` (bridge scaffolding). |
| Voice command routing | `VoiceCommandRouter.Route()` — CLOSED enum, no LLM in the routing path; grounded questions fall through to None. Tests in `Tests/VoiceRouterTests.cs`. **Good safety base for §10.** |
| Locales | not modeled (single Speak string). |
| Rate / pitch | not modeled at the interface. |
| Is UI text spoken directly? | The interface takes a raw string; there is no planner, so a caller would pass whatever text it has — including UI/Markdown/status. **This is the core problem V2 fixes.** |
| Markdown / tables spoken? | nothing prevents it today (no normalizer). |
| Queue / cancel / lifecycle | only `Stop()`; no priority queue, no barge-in, no audio-focus, no duplicate suppression. |
| Audio cached? | no. |
| SSML? | no. |
| On-device vs remote | Android system TTS is the intended on-device baseline; no cloud provider wired. |
| Persona voice mapping | none. |
| Existing fixture audio | none. |

## Core problem
There is no spoken-language layer: text goes straight to `Speak()`. Naturalness cannot be fixed by
pitch/rate alone because the INPUT is UI/Markdown/status text read flat, all at once, uninterruptible.
V2 inserts: canonical state → planner → pronunciation → deterministic prosody → provider adapter →
interruptible queue → safe command router → evaluation.
