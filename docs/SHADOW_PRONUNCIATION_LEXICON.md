# Shadow pronunciation lexicon

`voice/pronunciation/en-US.json` + `voice/pronunciation/zh-CN.json`. Applied by
`lib/voice/shadow-pronunciation.mjs`. Covers Shadow technical terms (XREAL, Ed25519, SHA-256, GDPR,
SR 26-2, FICO, DTI, LTV, AUC, GBM, JSON, API, OCR, 3DoF, 6DoF, B0L1). Rules: full hashes are NOT
spoken by default (short prefix + "shown in full on screen"; an explicit "read full identifier" action
reads them); evidence/claim IDs are read character by character (E-101 → "E one oh one" / "E 一〇一");
sequence numbers are read as words; original evidence quotes are never altered. Adapters use SSML
phoneme/sub/say-as when supported, safe plain-text substitution otherwise.
