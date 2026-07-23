# Token parity — remaining gaps (deferred, honest)

This increment established the canonical source + invariants + tests + the confirmed-conflict fixes. NOT done
(next increments):
- ~~**Full generation** of Unity C# / Three.js JS / CSS token tables FROM the JSON~~ — **DONE** (token-codegen
  increment): `scripts/generate-tokens.mjs` generates all three adapters; `--check` + `test/token-codegen.test.js`
  guard against drift. See TOKEN_CODEGEN_IMPLEMENTATION.md. (Runtime consumers still validate against the
  generated table rather than importing it — see TOKEN_CODEGEN_REMAINING_GAPS.md.)
- ~~**Token-review page**~~ — **DONE**: `reports/spatial-ux-v11/token-review/index.html` (offline, all 37
  states by category + distinctness pairs + grayscale profile). See TOKEN_VISUAL_REVIEW.md.
- ~~**Aligning Three.js verified shade** to green (currently gray by design)~~ — **RESOLVED** as the named
  `AuditRoomProvenance` profile: neutral resting surface, verification carried by red-tamper + green-heal-pulse.
  Pinned by `test/threejs-profile-override.test.js`. See TOKEN_PROFILE_OVERRIDE_POLICY.md.
- **Full EN/ZH labels wired into every runtime surface** — the canonical carries them; not every surface
  reads them yet (e.g. guided-story node labels still English where the story fixture lacks zh).
- Device flags remain false (no Beam Pro).
