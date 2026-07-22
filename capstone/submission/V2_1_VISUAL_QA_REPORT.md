# V2.1 visual QA report

Targeted polish pass over V2. New outputs: `SHADOW_CAPSTONE_PRACTICE_PRESENTATION_V2_1.pptx/.pdf`, `previews-v2-1/`, `SHADOW_CAPSTONE_PRACTICE_PRESENTATION_V2_1_NOTES.md`, this report. V2 and V1 files untouched. Generated 2026-07-21.

## Fact refresh (single source: `capstone-facts-v2-1.json`)

Re-ran the actual suite on the **final audited branch** `feat/shadow-shared-story-adapters @ 5f655e8` (`node scripts/run-tests.mjs`). Did **not** reuse the 1,866 handoff number or the 1,858 (V2) number.

| Fact | Verified value |
|---|---|
| Node tests | **1,892 pass / 1,895 total / 3 skip / 0 fail / 36 suites** |
| Shared scene + guided-story contract | AUTHORED + HOST-TESTED (`shadow-3d-scene-v1` + `shadow-guided-story-v1` compiler w/ cross-target semantic hash) |
| Three.js story adapter | HOST-TESTED (adapter contract) + BROWSER-RENDERED |
| HTML story adapter | HOST-TESTED (semantic-convergence parity) |
| Unity adapter | UNITY-AUTHORED + C# contract-drift HOST-TESTED; editmode/playmode NOT run here; DEVICE-VALIDATION-PENDING |
| Android artifact | ANDROID-BUILT · `mock-stable-5168b07.apk` · 24,442,084 B · SHA-256 recorded · not device-validated |
| Explainers | **3** (audit-chain, reason-code-attestation, persona-deliberation) |
| Ingest audit | structural HOST-TESTED / semantic PRODUCTION-EVALUATION-PENDING |
| MCP tools | 11 · Unity 6000.0.23f1 · profiles banking-v1 / data-science-v1 / coding-agent-v1 |

Removed the internal note **"(V1 said 1,824 / 1,827)"** — the deck now shows only the current verified number. PDF text scan confirms **0** occurrences of 1,824 / 1,858 / 1,866 and **0** of "V1 said".

## Per-instruction fixes

| # | Item | Fix | Verified |
|---|---|---|---|
| 1 | Refresh all facts | Re-ran suite; new facts file drives every string | ✅ 1,892/1,895 in deck |
| 2 | Slide 5 stray "RED / pending" | Root cause: band right-tags at x=10.35 collided **behind** the evidence-bundle side rail, leaking "…RENDE**RED**" / "device-**pending**". Removed the rail + off-panel tags; maturity chip now sits **inside** each band, fully bounded | ✅ no stray text, 3 layers readable |
| 3 | Slide 1 visual | Tighter crop around the arc (aspect 4.71), enlarged ~25%, black margin removed, tiny verifier text dropped, nodes projector-visible, honest "research prototype" label kept; fits above footer (no overflow) | ✅ |
| 4 | Slide 4 semantic shapes | Six distinct editable shapes: document, gear, hexagon, linked rings, 8-point seal, circle-check | ✅ |
| 5 | Slide 6 differentiation | Three structurally distinct columns: Banking (real "NEVER ONE GREEN" trust crop), Data Science (dataset→model→metric→selection chips), Coding Agent (diff +/− block, tests ✓✓, commit hash); shared grammar strip retained | ✅ no recolored-identical cards |
| 6 | Slide 7 fixture consistency | Canonical fixture = **sequence 3** (matches host test `seq-3 first failure ring`); slide labelled "Spatial replay fixture — first failed sequence 3"; notes instruct the live demo to use seq 3 | ✅ seq 3 on slide 7 + 9 + notes |
| 7 | Slide 8 crop | Tighter verifier crop; signature / verifier-integrity / independent-comparison rows readable; empty margins + network-transparency trimmed; caption below frame (no overlap); "FIXTURE release key" retained | ✅ |
| 8 | Slide 9 Unity honesty | Two **Three.js** renders labelled Three.js; Unity described in **text** ("not pictured — no Game View capture"); no Three.js image mislabelled Unity; guardrails reduced to a muted list; scene-contract line kept | ✅ |
| 9 | Slide 10 refresh | 1,892 passed / 0 failed / 3 skipped; stale note removed; audited commit+date in small text; spatial + Android statuses refreshed from artifact | ✅ |
| 10 | Slide 11 refresh | NOW = scene/story contract authored+host-tested, Three.js adapter host-tested+browser-rendered; NEXT = Unity production integration/validation; ingest structural host-tested / semantic production-pending (not device-pending) | ✅ |
| 11 | Slide 12 contrast | First statement raised from muted to bright INK (hierarchy kept below bold white); repo URL + "Thank you" brightened | ✅ |
| 12 | Backups | 13 statuses refreshed + larger labels; 15 limitations refreshed (Unity editmode/playmode nuance) + honest ones kept; 16 mp4 path replaced with "Open bookmarked fallback video" | ✅ |
| 13 | Consistency | Title "…for AI-Assisted Decisions" on slide 1 = report/notes; seq 3, 1,892/1,895, APK size/hash, 3 profiles, MCP 11, contract/Unity/device/signing/user-study statuses all aligned to the facts file | ✅ PDF scan clean |

## Projector / visual sweep

- Rendered all 16 slides to PNG (`previews-v2-1/slide-01..16.png`) + **contact sheet** (`previews-v2-1/CONTACT_SHEET.png`).
- Simulated 1280×720 projector at reduced brightness/contrast (`previews-v2-1/projsim-{01,05,07,09,10,12}.png`).
- Checks: no clipped objects · no stray text · no off-slide content · no tiny critical UI text (verifier/tamper fields legible after crop) · every status carries a text label (never color-only) · no image stretching (aspect preserved) · consistent margins + footer/slide-number alignment.

## PDF text QA (deck)

0 × `1,824` · 0 × `1,858` · 0 × `1,866` · 0 × `V1 said` · 0 × `five-voice loan council` · 0 × `shadow-verify-full-demo.mp4` (raw path). Present: `1,892`, `1,895`, `AI-Assisted Decisions`, `seq: 3` / `SEQUENCE 3`, `24.4 MB`, `MCP (11)`, `not pictured`.

## Preservation

V2 (`..._V2.pptx/.pdf`, `build_deck_v2.py`, `previews-v2/`, `figures-v2/`) and all V1 files untouched. V2.1 uses `_V2_1` filenames and `figures-v2-1/` / `previews-v2-1/`.
