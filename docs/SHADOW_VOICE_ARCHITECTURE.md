# Shadow voice architecture (V2)

Provider-independent spoken-language pipeline. The naturalness fix is structural, not a pitch change.

```
canonical guided-story semantic (Phase 4)
  → ShadowSpeechPlanner        (meaning → spoken segments; evidence-first; progressive disclosure)
  → pronunciation (lexicon)    (technical terms, ID reading; full hashes NOT spoken)
  → ShadowProsodyPlanner       (deterministic role → rate/pitch/pause; no randomness, no fake breaths)
  → shadow-spoken-utterance-v1 (validated, SSML-free, untrusted-safe contract)
  → IShadowTtsProvider adapter (Android system TTS offline baseline; optional cloud opt-in; fixture)
  → ShadowVoiceQueue + TurnManager (priority + barge-in + audio focus + lifecycle)
  → ShadowVoiceRouter          (closed-set commands; regulated actions need non-voice confirmation)
  → evaluation                 (semantic-preservation tests now; listener study later)
```

Reference implementation (Node, testable + drives fixture audio): `lib/voice/*.mjs`. Unity mirror
(native, on-device): `Assets/ShadowLens/VoiceV2/*`. Both consume the SAME contract; semantics are
identical. See `SHADOW_VOICE_STYLE_GUIDE.md`, `SHADOW_SPOKEN_UTTERANCE_CONTRACT.md`,
`SHADOW_VOICE_ACTION_SAFETY.md`.

Measured (macOS say fixture): en 40.3s→10.5s (−74%), zh 55.2s→12.9s (−77%). Engineering evidence, not
a naturalness claim (that needs listeners).
