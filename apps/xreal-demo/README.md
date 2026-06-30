# Shadow × XReal Air 2 Ultra — JARVIS spatial council demo

Scaffold shipped 2026-06-30 for the Y.U. Dean + Vice-Provost mid-July
demo cell. Single-file HTML + Three.js + WebXR — no bundler, no build.

## Run locally (desktop preview)

```bash
cd apps/xreal-demo
python3 -m http.server 8000
# Open http://localhost:8000 in any modern browser.
# You'll see the 5 council panels in a half-circle floating arc.
# The "Enter spatial AR" button is disabled on desktop (no XR session).
```

The page tries to fetch `/api/deliberate` from the same host. If that
fails (e.g. you're previewing without `vercel dev`), it falls back to
a baked-in mock loan packet (`MOCK_LOAN` + `MOCK_RESPONSE` in the HTML)
so the visual still works.

## Run on XReal Air 2 Ultra spatial AR

1. Plug the XReal Air 2 Ultra into a Mac, switch into spatial AR mode.
2. Open Chrome (Mac, with WebXR enabled via `chrome://flags`) and
   navigate to the host serving this file.
3. Click **"Enter spatial AR (XReal)"** at bottom right.
4. The 5 podiums appear floating ~1.5m from you in a 120° arc.

For demo backend: run `vercel dev` from the shadow-mentor repo root
in another terminal so the panels carry live council output.

## What this is + what's still TODO

✓ Five floating verdict panels (one per voice), arc layout, breathing animation.
✓ Live `/api/deliberate` fetch with graceful mock fallback.
✓ WebXR session bootstrap for XReal Air 2 Ultra.
✓ Verdict colour stripe (green approve / amber escalate / red block).

✗ No MediaPipe Hands gesture-vote input (v0.2 — needs camera grant).
✗ No 3D Gaussian Splatting ambient background (Section 4.6 of the IEEE
  VR 2027 paper — needs captured analyst-desk 3DGS asset).
✗ No traceability dict surfaced inside the panel (currently shows
  verdict + 1-line rationale only).
✗ No Brilliant Frame / Even G2 render paths (different fov/binocular
  geometry).

These are scoped for the September full-paper submission iteration.
