# Shadow × Apple Vision Pro — banking analyst spatial review

Scaffold shipped 2026-07-02 as a sibling to `apps/xreal-demo` (shipped
2026-06-29). Targets the mid-July 2026 Y.U. Dean + Vice-Provost demo
double-barrel (XReal + Vision Pro at once) and the IEEE VR/VIS 2027
paper §4.6 hardware-comparison evaluation.

## Run locally (desktop preview)

```bash
cd apps/vision-pro-demo
python3 -m http.server 8000
# Open http://localhost:8000 in Safari.
# 5 podium panels render in a half-circle arc.
# Click any panel to simulate gaze-selection (highlights with green ring).
# The "Enter Vision Pro spatial" button is only enabled in Safari
# on macOS 14+ with Vision Pro WebXR enabled, OR inside Vision Pro's
# built-in Safari.
```

The page tries to fetch `/api/deliberate` from the same host. If that
fails (e.g. you're previewing without `vercel dev`), it falls back to
a baked-in mock loan packet (LBO scenario with 5 voices) so the visual
still works.

## Run on Apple Vision Pro

1. Wear the Vision Pro and open Safari.
2. Navigate to the host serving this file (localhost via a tunneled URL,
   your Vercel preview, or a static host).
3. Click **"Enter Vision Pro spatial"** in the bottom-right.
4. The 5 podiums appear floating ~1.5m from you in a 120° arc.

### Gestures

- **Gaze** at a panel → green ring lights up (the "hover" analog).
- **Pinch** (thumb + index) → commits an analyst-override intent on the
  currently-gazed voice (visible in Safari console).
- Two-hand pinch-and-pull for scene repositioning is *planned*, not yet
  implemented in this scaffold.

## Vision Pro-specific implementation notes

Unlike XReal (arc-fan navigated by head movement), Vision Pro's input
paradigm is **transient-pointer**: gaze selects, pinch commits. So this
scaffold differs from the XReal sibling in two places:

1. **Gaze ray with hit-test** — every frame we raycast from the XR
   controller's world-space matrix against panel plates. The nearest
   hit gets highlighted (green ring + slightly increased plate opacity).
   Coming out of hover clears the highlight. Runs at 60 fps on M2 Pro
   Vision Pro without visible latency.

2. **`select` event handling** — Safari fires `select` on the XR
   controller when the user pinches while gazing. We use that as the
   commit event, and log an analyst-override intent for whichever
   voice is currently gazed at. In a production build this would post
   to `/api/deliberate/override` (that endpoint doesn't exist yet).

## Deferred to follow-on ships

- **visionOS Enterprise sideload** — the JD demo runs in Safari WebXR
  as a *public-visibility* build. Enterprise-signed side-load for a
  bank IT department to install on their own Vision Pros lands as a
  separate ship (needs Apple Developer Enterprise Program enrollment).

- **3D Gaussian Splatting ambient background** — same open work as the
  XReal sibling. Currently: dark solid background.

- **Traceability dict overlay inside the panel** — same open work.
  Currently: verdict + 1-line rationale only. Wire the
  `buildReproducibilityArtifact` contract shipped 2026-07-02 into the
  panel UI for the September full-paper submission.

- **Two-hand pinch-and-pull for scene repositioning** — Vision Pro's
  wrist-tracking supports this; scaffold does not yet.

- **Verdict override → live post to backend** — currently just logs to
  console. Wire to `/api/deliberate/override` once that endpoint exists.

## Why this sibling exists

The XReal Air 2 Ultra ($699 tethered display glasses) and Apple Vision
Pro ($3,499 spatial computer) are both target devices for Shadow's
spatial-XR analyst surface. They have *very* different input paradigms
and slightly different rendering constraints. Rather than force one
codebase to fit both, we ship parallel scaffolds and let the IEEE VR
2027 paper §4.6 compare frame-rate, latency, and gesture-to-verdict
timing between the two.
