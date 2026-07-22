# Token parity — remaining gaps (deferred, honest)

This increment established the canonical source + invariants + tests + the confirmed-conflict fixes. NOT done
(next increments):
- **Full generation** of Unity C# / Three.js JS / CSS token tables FROM the JSON (currently the JS vocabulary
  + Unity tokens mirror it by hand, validated by tests but not auto-generated). A generator is the next step
  once the model is stable.
- **Token-review contact-sheet page** (§10) — a rendered comparison of each state across Unity/Three.js/
  browser/high-contrast/grayscale. Deferred.
- **Aligning Three.js verified shade** to green (currently gray by design) — left as a documented intentional
  deviation; revisit during the Audit Room UX pass.
- **Full EN/ZH labels wired into every runtime surface** — the canonical carries them; not every surface
  reads them yet (e.g. guided-story node labels still English where the story fixture lacks zh).
- Device flags remain false (no Beam Pro).
