# Shadow voice tuning rules (Phase 8 §11)

Tune the PLANNER before the provider. Priority order: 1) sentence structure · 2) progressive
disclosure · 3) pauses · 4) pronunciation · 5) rate · 6) pitch · 7) provider/voice.

Never improve "naturalness" by: adding fillers · fake breaths · emotional language · hiding
limitations · omitting evidence references · excessive persona acting. The on-screen EXACT status
always stays available regardless of how it is spoken.

Examples:

- Too robotic: "Verification failed. Hash chain failed. Sequence three failed."
  Better: "The record first breaks at sequence three. Steps four through six are affected."
- Too formal: "Independent comparison has not been performed."
  Better spoken: "The page matches its signed manifest. But the release key has not been checked
  through a separate channel." (the exact status pill stays on screen)

The planner already emits result → source → limitation → optional detail with spoken-friendly
phrasing (see lib/voice/shadow-speech-planner.mjs). Any future phrasing change must keep the
semantic-preservation tests green (first-failure sequence, downstream IDs, statuses, verbatim quotes,
abstention/contradiction, limitations).
