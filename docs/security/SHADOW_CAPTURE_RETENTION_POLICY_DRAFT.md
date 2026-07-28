# Shadow capture retention policy (DRAFT)

Applies to the XREAL Eye RGB-camera / OCR path only — which is architecture + fixture tests today, not
a shipping capability. Written now so the pipeline is bounded before any real frame exists. DRAFT — not
a production or legal commitment.

## Principles
1. **No capture without capability + permission + a real non-black frame.** The detector must report
   `RGB_CAMERA_AVAILABLE` + `FIRST_PERSON_VIEW_AVAILABLE`; the latter is set only after a validated
   non-black frame. Until then the state is `CAMERA UNAVAILABLE` and capture is disabled.
2. **Hash, don't hoard.** A captured frame is hashed (SHA-256) for the evidence record; the raw bytes
   are held only long enough to hash + (optionally) OCR, then released. Frames are **not** retained
   indefinitely by default.
3. **OCR output is source geometry, not the image.** The evidence event stores recognized text +
   bounding boxes + the frame hash — never the raw image in the guided story.
4. **Evidence-free diagnostics.** Diagnostics never contain frame bytes or recognized text.
5. **Deletion is the default.** In-memory frames are dropped after processing; any on-disk cache (if
   ever added) is session-scoped and cleared on reset / exit.
6. **Permissions minimal and late.** Camera/recording permissions (`RECORD_AUDIO` +
   `FOREGROUND_SERVICE_MEDIA_PROJECTION` per official XREAL docs) are declared only in the XREAL
   candidate, requested at point of use. Raw `CAMERA` access is officially undocumented for XREAL →
   fail closed until proven on device.

## Pipeline gates (each must pass or the frame is rejected)
capability → permission → frame acquisition → timestamp (monotonic) → dimensions/format → orientation
→ **non-black-frame validation** → immutable bytes → SHA-256 → OCR → source-map alignment → evidence
event → sealed guided story → verifier.

Rejected frames (black, duplicate, malformed) never become evidence and are dropped.

## Interfaces (fixture-tested; no real frames)
`IStillCaptureProvider`, `IOcrProvider` (existing `Core/IProviders.cs`) + the Eye adapters behind
`SHADOW_XREAL_SDK`. Fixture tests cover metadata, timestamp monotonicity, byte hashing, orientation,
black-frame + duplicate rejection, OCR result shape, and source-coordinate mapping.
