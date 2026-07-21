# Figure inventory — Shadow capstone report

Every figure, its caption, source path, and honest status. Real screenshots come from the repository's Playwright browser-acceptance run — they are not mock-ups. Diagrams are provided as regenerable text/Mermaid sources.

| Fig | Caption | Source | Status |
|---|---|---|---|
| 1 | Shadow layered architecture (Core / Profiles / Interfaces) | report §7 (text diagram) + Mermaid in Appendix E | diagram |
| 2 | Evidence lifecycle: Source → Action → Event → Hash Chain → Signature → Verify | report §6 / deck Slide 4 | diagram |
| 3 | Valid hash chain (pristine) | tamper case study §13.6 (text) | diagram |
| 4 | Tamper propagation: first failed sequence + downstream | tamper case study §13.6 (text) | diagram |
| 5 | Browser verifier — valid evidence (EN) | `verify-acceptance/screenshots/en-valid-evidence.png` → `figures/fig05-verifier-valid-en.png` | BROWSER-RENDERED / RECORDED |
| 6 | Browser verifier — tampered evidence (EN) | `verify-acceptance/screenshots/en-tampered-evidence.png` → `figures/fig06-verifier-tampered-en.png` | BROWSER-RENDERED |
| 7 | Verify the Verifier — assets match signed manifest (EN, fixture) | `verify-acceptance/screenshots/en-verifier-valid.png` → `figures/fig07-verify-the-verifier-en.png` | BROWSER-RENDERED / FIXTURE-SIGNED |
| 7b | Verify the Verifier — asset mismatch | `verify-acceptance/screenshots/en-verifier-mismatch.png` → `figures/fig07b-verifier-mismatch-en.png` | BROWSER-RENDERED |
| 8 | Bilingual parity — valid evidence (简体中文) | `verify-acceptance/screenshots/zh-CN-valid-evidence.png` → `figures/fig08-verifier-valid-zh.png` | BROWSER-RENDERED |
| 9 | Three.js layout comparison | `demos/replay/3d/` (rendered) — not embedded in draft | BROWSER-RENDERED (prototype) |
| 10 | Claim–evidence graph | `lib/claim-evidence-graph.mjs` — schematic | SOURCE-AUTHORED |
| 11 | Multi-profile comparison (banking / data-science / coding) | deck Slide 6 table | reference |
| 12 | Implementation-status ladder | report §7 / `product-facts.json` capability_status_ladder | reference |

**Additional real media available** (not all embedded in the draft): `media/wednesday/browser/shadow-verify-full-demo.mp4` and `-short-demo.mp4/.webm`; numbered flow screenshots `media/wednesday/browser/screenshots/01–09` including `09-en-limitations.png` (→ `figures/fig-limitations-en.png`).

**No fabricated device screenshots.** No figure depicts on-device (Beam Pro / XREAL) behavior, because none has been validated.
