# shadow-spoken-utterance-v1

Provider-independent plan of WHAT to say + prosody INTENT. Schema:
`schemas/shadow-spoken-utterance-v1.schema.json`. Carries NO provider SSML and NO executable markup;
adapters render SSML from validated segments. Every string is treated as untrusted (caps, closed
enums, `__proto__` rejection, markup rejection — see `lib/voice/shadow-spoken-utterance.mjs`).

Top-level: contract_version · utterance_id · locale (en-US/zh-CN) · role · intent · semantic_source_ids
· original_text · spoken_segments · prosody_profile · interruptibility · priority (P0–P4) ·
confirmation_required · fixture_live_device_status · limitations.

Each segment: segment_id · text · semantic_role (result/source/limitation/detail/label/quote/prompt/
warning) · source_reference · emphasis · pause_before_ms · pause_after_ms · rate_multiplier ·
pitch_offset · volume_multiplier · pronunciation_tokens · can_interrupt_after · accessibility_text ·
is_verbatim_quote. A `quote` segment is byte-exact and `can_interrupt_after:false`.
