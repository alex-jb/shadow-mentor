# V2 asset selection — real product screenshots

Every image on the V2 deck is a **real product render**, not a mock or a generic stock graphic. This is the direct fix for the V1 critique ("generic rounded cards, spatial slide showed no spatial UI"). Each row records path, origin commit, capability status, locale, scenario, crop, target slide, and reason. Files live in `capstone/submission/figures-v2/`.

| File | Origin branch @ commit | Status | Locale | Scenario | Crop | Slide | Why chosen | Type |
|---|---|---|---|---|---|---|---|---|
| `v2-3d-current-arc.png` | `research/unity-threejs-spatial-ux-v2` @ `bb33196` | BROWSER-RENDERED · RESEARCH-PROTOTYPE | EN | banking loan-file audit arc, all VERIFIED | full | **1 (hero)**, 9 | Clean "healthy chain" render; the verification-checks panel (incl. "Analytical correctness: NOT EVALUATED") is legible — sets forensic identity immediately | Three.js render |
| `v2-3d-tamper-propagation.png` | `research/unity-threejs-spatial-ux-v2` @ `bb33196` | BROWSER-RENDERED · RESEARCH-PROTOTYPE | EN | seq-3 Council-claims TAMPERED, downstream 4/5/6 NOT VERIFIED | full | **7 (hero)** | The single most important asset — a real render that literally shows tamper localization + "Analytical correctness: NOT EVALUATED". Carries the whole thesis | Three.js render |
| `v2-3d-layered-dag.png` | `research/unity-threejs-spatial-ux-v2` @ `bb33196` | BROWSER-RENDERED · RESEARCH-PROTOTYPE | EN | provenance DAG layout | full | 9 | Shows a *second distinct* spatial layout so the spatial slide proves variety, not one static shot | Three.js render |
| `v2-3d-timeline.png` | `research/unity-threejs-spatial-ux-v2` @ `bb33196` | BROWSER-RENDERED · RESEARCH-PROTOTYPE | EN | timeline layout | full | backup | Fourth layout evidence for Q&A | Three.js render |
| `v2-3d-hybrid.png` | `research/unity-threejs-spatial-ux-v2` @ `bb33196` | BROWSER-RENDERED · RESEARCH-PROTOTYPE | EN | hybrid 2D/3D layout | full | backup | Shows the 2D/3D hybrid + fallback story | Three.js render |
| `v2-verifier-valid-en.png` | main @ `5106799` | BROWSER-RENDERED · FIXTURE-SIGNED | EN | Verify-the-Verifier, manifest VERIFIED | full | **8 (hero)** | Large embedded verify-the-verifier with room for callouts, incl. "independent comparison NOT PERFORMED" | Browser screenshot |
| `v2-verify-valid-en.png` | main @ `5106799` | BROWSER-RENDERED · FIXTURE-SIGNED | EN | evidence bundle VALID | full | backup / report | Baseline "all green" verifier state | Browser screenshot |
| `v2-verify-tampered-en.png` | main @ `5106799` | BROWSER-RENDERED · FIXTURE-SIGNED | EN | evidence bundle TAMPERED | full | report | Flat 2D tamper result to pair with the 3D render | Browser screenshot |
| `v2-verify-valid-zh.png` | main @ `5106799` | BROWSER-RENDERED · FIXTURE-SIGNED | zh-CN | verifier 简体中文 | full | report | Bilingual proof (EN + zh-CN) | Browser screenshot |
| `v2-explainer-audit-chain.png` | `feat/shadow-lens-explainers` @ `19f52f0` | HOST-TESTED · BROWSER-RENDERED | EN | audit-chain explainer poster | full | report | Real explainer poster for the lifecycle section | Self-contained HTML/SVG |
| `v2-explainer-reason-code.png` | `feat/shadow-lens-explainers` @ `19f52f0` | HOST-TESTED · BROWSER-RENDERED | EN | reason-code attestation explainer | full | report | Real explainer poster | Self-contained HTML/SVG |
| `v2-explainer-persona.png` | `feat/shadow-lens-explainers` @ `19f52f0` | HOST-TESTED · BROWSER-RENDERED | EN | persona-deliberation explainer | full | report | Shows council = stance strength, not confidence | Self-contained HTML/SVG |
| `v2-explainer-how-en.png` | `feat/shadow-lens-explainers` @ `19f52f0` | BROWSER-RENDERED | EN | guided "how it works" | full | report | Integration render | Self-contained HTML/SVG |
| `v2-3d-tamper-propagation.png` (reuse) | — | — | — | — | — | report | Same gold render embedded inline in report §Tamper | — |
| `v2-3d-claim-to-source.png` | `research/unity-threejs-spatial-ux-v2` @ `bb33196` | BROWSER-RENDERED · RESEARCH-PROTOTYPE | EN | claim→source resolution | full | report | Provenance resolution figure | Three.js render |
| `v2-3d-hybrid-2d-fallback.png` | `research/unity-threejs-spatial-ux-v2` @ `bb33196` | BROWSER-RENDERED · RESEARCH-PROTOTYPE | EN | 2D fallback | full | report | Proves 3D is never required to verify | Three.js render |
| `v2-3d-zh-CN-layout.png` | `research/unity-threejs-spatial-ux-v2` @ `bb33196` | BROWSER-RENDERED · RESEARCH-PROTOTYPE | zh-CN | spatial 简体中文 | full | backup | Bilingual spatial evidence | Three.js render |
| `v2-landing-en.png` | main @ `5106799` | BROWSER-RENDERED | EN | landing | full | report | Context figure | Browser screenshot |

## Deliberate omissions (honesty)

- **No Unity Game View screenshot** exists as a real device/editor capture beyond an authoring preview, so **Unity is shown via the Three.js renders and labelled "unity-authored · device-validation-pending"** on the spatial slide. The deck never displays a fabricated Unity-on-device shot.
- **No Beam Pro / XREAL device photo** is used anywhere — there is no device validation to depict.
- The 3D renders are labelled **"research prototype"** in-caption so no viewer mistakes them for a shipped device experience.
