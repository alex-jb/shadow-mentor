# Shadow spatial user study protocol (DRAFT — not yet run)

## Purpose
Compare how well people locate audit failures and distinguish integrity from correctness across four
presentations of the SAME guided stories. No UX-superiority claim is made until data exists.

## Conditions (within-subject, order-counterbalanced)
- A. 2D audit table (the text fallback).
- B. Three.js hybrid (browser player, `story-player.html`).
- C. Unity desktop guided story.
- D. Beam Pro spatial experience — ONLY after device validation exists (device-blocked; excluded until then).

## Participants
Recruit only with informed consent + an approved procedure. Target n per a power analysis once a pilot
variance estimate exists. No participants are run in V5 (this is the protocol only).

## Tasks + measures
See `SHADOW_USER_STUDY_TASKS.csv` and `SHADOW_USER_STUDY_SCORING.md`. Same 8 tasks in every condition,
using the same three canonical stories (banking / reason-code / persona) so meaning is constant and only
presentation varies.

## Procedure
1. Consent + demographics + XR-comfort screen.
2. Training story (not scored) in each condition.
3. 8 tasks per condition; record time/accuracy/selections/backtracking.
4. Post-condition: NASA-TLX + trust-calibration + comfort + preference.
5. Debrief.

## Analysis
Per-condition means + confidence intervals; T4 (integrity != correctness) as the primary comprehension
metric. Report honestly; do not assert a winner without the data.

## Ethics
No deception, no PII beyond coarse demographics, right to withdraw, data stored de-identified. D is not
run until the device path is validated and comfort/safety are confirmed.
