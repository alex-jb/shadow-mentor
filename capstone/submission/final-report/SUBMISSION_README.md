# Shadow Capstone I — submission folder map

**Student:** Alex Ji · M.S. Computer Science · Yeshiva University · Capstone in Computer Science I · 2026-07-21 (DRAFT)
**Project:** Shadow — A Cryptographically Verifiable Evidence and Spatial Audit System for AI-Assisted Decisions.

## What to upload to Canvas
1. `final-report/SHADOW_CAPSTONE_FINAL_REPORT_DRAFT.pdf` — the report (16 pp).
2. `presentation/SHADOW_CAPSTONE_PRACTICE_PRESENTATION.pdf` — the practice deck.
   *(DOCX and PPTX are included as editable sources.)*

## Folder map
```
capstone/submission/
├── SUBMISSION_INVENTORY.md            # file · size · sha256 · status
├── final-report/
│   ├── SHADOW_CAPSTONE_FINAL_REPORT_DRAFT.md    # authoritative source
│   ├── SHADOW_CAPSTONE_FINAL_REPORT_DRAFT.pdf   # 16 pp
│   ├── SHADOW_CAPSTONE_FINAL_REPORT_DRAFT.docx
│   ├── FIGURE_INVENTORY.md
│   ├── CLAIM_SOURCE_MATRIX.md          # every claim → evidence → status
│   └── REFERENCES.md
├── presentation/
│   ├── SLIDE_SOURCE.md                 # authoritative slide source
│   ├── SHADOW_CAPSTONE_PRACTICE_PRESENTATION.pptx
│   ├── SHADOW_CAPSTONE_PRACTICE_PRESENTATION.pdf
│   ├── SPEAKER_NOTES.md · PRACTICE_SCRIPT.md
│   ├── DEMO_RUNBOOK.md · QUESTIONS_AND_ANSWERS.md
│   ├── PRACTICE_CHECKLIST.md · PRESENTATION_README.md
│   └── previews/
└── figures/                           # real rendered screenshots
```

## Regenerate documents
```bash
# report
cd capstone/submission/final-report
pandoc SHADOW_CAPSTONE_FINAL_REPORT_DRAFT.md -o SHADOW_CAPSTONE_FINAL_REPORT_DRAFT.docx
pandoc SHADOW_CAPSTONE_FINAL_REPORT_DRAFT.md -o SHADOW_CAPSTONE_FINAL_REPORT_DRAFT.pdf --pdf-engine=tectonic
# deck
cd ../presentation
pandoc SLIDE_SOURCE.md -o SHADOW_CAPSTONE_PRACTICE_PRESENTATION.pptx --slide-level=1
pandoc SLIDE_SOURCE.md -o SHADOW_CAPSTONE_PRACTICE_PRESENTATION.pdf -t beamer --slide-level=1 --pdf-engine=tectonic
```

## Terminology (consistent across all deliverables)
Evidence Bundle · Record Integrity · Hash Chain · Digital Signature · Source Resolution · External Anchor · Claim–Evidence Graph · Fixture Model · Device Validation Pending.
The deterministic council's per-voice number is a **persona prior — "STANCE STRENGTH"** — not model confidence and not probability of correctness.

## The one thing this submission never claims
Cryptographic verification establishes **integrity, not correctness.** Fixture-signed (not production). Android APK **built** (not device-validated). No user study yet. These are stated in the report's Limitations and repeated in the deck.
