# Shadow audio asset spec

Every audio asset (TTS-rendered or human-recorded) records: provider · voice · locale · script ·
semantic source · fixture/device status · duration · SHA-256 · license. Fixture audio is desktop
macOS `say` and is labelled as such — NEVER Beam Pro. Human recordings (optional, not required for V7)
additionally record: speaker authorization · recording date · usage rights · loudness normalization ·
source file hash; no cloning/impersonation of a real person.

Allowed processing (measured only): loudness normalization · peak limiting · silence trimming · small
fades · sample-rate/channel consistency · gentle EQ. NOT allowed unless a user study supports it: fake
breaths · random hesitation · reverb · emotion filters · voice aging · artificial noise.

Audit with `tools/audit-shadow-audio.mjs` (sample rate, channels, duration, size, SHA-256, clipping
heuristic). Earcons: never the sole status signal, no victory jingle, no loud alarm for ordinary
failure, independent volume, disable-able, repository-owned/licensed only.
