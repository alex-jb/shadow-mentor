# Presentation package — Shadow capstone (practice)

## Files
| File | Purpose |
|---|---|
| `SHADOW_CAPSTONE_PRACTICE_PRESENTATION.pptx` | Editable deck (pandoc from `SLIDE_SOURCE.md`) |
| `SHADOW_CAPSTONE_PRACTICE_PRESENTATION.pdf` | Present-from PDF (beamer) |
| `SLIDE_SOURCE.md` | Authoritative slide source — edit here, regenerate |
| `SPEAKER_NOTES.md` | Full spoken script with per-slide timing (~8:30) |
| `PRACTICE_SCRIPT.md` | One-line-per-slide cue cards |
| `DEMO_RUNBOOK.md` | Live-demo sequence, fallback levels A–D, exact commands |
| `QUESTIONS_AND_ANSWERS.md` | 18 likely questions with honest answers |
| `PRACTICE_CHECKLIST.md` | Pre-talk checklist incl. an honesty pass |
| `previews/` | Per-slide preview images (if generated) |

## Regenerate the deck
```bash
cd capstone/submission/presentation
pandoc SLIDE_SOURCE.md -o SHADOW_CAPSTONE_PRACTICE_PRESENTATION.pptx --slide-level=1
pandoc SLIDE_SOURCE.md -o SHADOW_CAPSTONE_PRACTICE_PRESENTATION.pdf -t beamer --slide-level=1 --pdf-engine=tectonic
```

## Design intent
Clean, not dense. 12 slides, ~8–10 minutes plus questions. The tamper demonstration (Slide 7) is the strongest moment; everything else supports it. Every capability is stated at its true maturity — nothing claims device validation or production readiness.
