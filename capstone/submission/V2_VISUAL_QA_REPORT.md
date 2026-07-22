# V2 visual + text-layer QA report

Generated 2026-07-21. Covers the redesigned deck (`SHADOW_CAPSTONE_PRACTICE_PRESENTATION_V2.pptx/.pdf`) and the truth-refreshed report (`SHADOW_CAPSTONE_FINAL_REPORT_DRAFT_V2.docx/.pdf`). V1 files were **not** modified.

## Deck — visual QA (16 slides: 12 main + 4 backup)

| Check | Result |
|---|---|
| Dark forensic identity from real product tokens (#090D12 bg, verified #2FD19A, tampered #FF5F6D, info #5CA8FF, warning #F2C14E) | ✅ every slide |
| Real product screenshots (not generic cards) | ✅ 6 distinct real renders/screenshots embedded (arc, DAG, tamper, verifier, explainer, + backups) |
| Tamper hero shows the actual tamper render + "Analytical correctness: NOT EVALUATED" | ✅ slide 7 (`v2-3d-tamper-propagation.png`) with 3 callouts + "Shadow reports" box |
| Verify-the-Verifier embedded large with callouts, shows "INDEPENDENT COMPARISON NOT PERFORMED" | ✅ slide 8 (`v2-verifier-valid-en.png`) |
| Spatial slide actually SHOWS spatial UI (fixes V1 critique) | ✅ slide 9 — two real Three.js layouts (arc + layered DAG) |
| Layout variety (not one repeated card template) | ✅ hero split, journey rail, lifecycle chain, layered bands, triptych, image-hero, two-up, big-number |
| Status never by color alone (text label always present) | ✅ every status carries a word (HOST-TESTED, FIXTURE-SIGNED, etc.) |
| Fonts reliable/system (Arial) at required sizes (title 32, hero 44–58, body ≥18) | ✅ |
| Honest status labels on every prototype asset | ✅ "research prototype", "unity-authored · device-pending", "built, not device-validated" |
| No overflow / text clipping | ✅ spot-checked slides 1,4,7,8,9,10,13 — clean |
| Renders to PDF + PNG previews non-zero | ✅ `SHADOW_CAPSTONE_PRACTICE_PRESENTATION_V2.pdf` (698 KB), `previews-v2/slide-01..16.png` |

## Report — text-layer QA (`SHADOW_CAPSTONE_FINAL_REPORT_DRAFT_V2.pdf`)

Pipeline: pandoc (MD→DOCX, clean Unicode) → LibreOffice soffice (DOCX→PDF). This replaces the V1 tectonic pipeline that produced soft-hyphen / "lan‐guage" corruption.

| Check | Result |
|---|---|
| Page count within 14–18 target | ✅ **18 pages** |
| U+FFFE (￾) occurrences | ✅ **0** |
| U+FFFD (�) occurrences | ✅ **0** |
| Soft-hyphen (U+00AD) occurrences | ✅ **0** |
| Zero-width space occurrences | ✅ **0** |
| Duplicate figure captions ("Figure N: Figure") | ✅ **0** |
| Figure numbering sequential | ✅ **1–8, no gaps** (V1 jumped 1,2 → 5–8) |
| Figures placed inline near relevant sections | ✅ Fig 2 at architecture, Fig 3–6 at verifier, Fig 7 at spatial, Fig 8 at tamper case study |
| Real embedded images | ✅ **7** raster images embedded (Fig 1 is an ASCII architecture block) |
| References embedded IN the PDF (IEEE `[n]` style) | ✅ 15 references, in-body citations `[1]`–`[15]` |
| Current test count present | ✅ "1,858 of 1,861" (3×) |
| Stale count only as superseded reference | ✅ 2 occurrences, both "an earlier draft… superseded" |
| "five-voice loan council" removed | ✅ **0** |
| "five-perspective fixture council" + "stance strength" | ✅ present |
| Semantic ingest audit = production-pending (not device-pending) | ✅ "a *production*-pending capability, **not** a device-pending one" |
| Scene contract = authored + host-tested | ✅ present |

## Consistency guard

`test/capstone-v2-consistency.test.mjs` — **8/8 passing.** Fails the build if the report, deck builder, notes, or cue card drift from `capstone-facts-v2.json` on: current test count, stale-count framing, council language, ingest-audit wording, scene-contract status, and core scalar facts (MCP=11, Unity 6000.0.23f1, APK sha/size, profiles).

## V1 preservation

V1 artifacts untouched — `SHADOW_CAPSTONE_FINAL_REPORT_DRAFT.md/.pdf`, `SHADOW_CAPSTONE_PRACTICE_PRESENTATION.pptx`, `build_deck.py`, `previews/`, `figures/`, and all V1 supporting docs remain in place. All V2 output uses `_V2` filenames or `figures-v2/` / `previews-v2/` directories.
