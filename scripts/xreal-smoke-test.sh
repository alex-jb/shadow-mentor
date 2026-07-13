#!/usr/bin/env bash
# scripts/xreal-smoke-test.sh
# 20-minute smoke test to run WHEN THE XREAL ONE PRO BOX ARRIVES WED 2026-07-16.
# Verifies the display works, the M5 replay demo renders legibly, and the
# tamper flow reads at glasses distance BEFORE Lora walks in the door.
#
# Usage:
#   bash scripts/xreal-smoke-test.sh
#
# The script does not touch the XREAL device itself (there's no CLI to poke).
# It sets up the browser tab + starts the local server so the moment the
# USB-C cable goes in, you're one keystroke from a demo.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "─── Shadow · XREAL One Pro smoke test ─────────────────"
echo "Root: $ROOT"
echo

# ─── Step 1: local build health check ────────────────────
echo "→ Step 1/6: full test suite (must be green before demo)"
node --test 'test/**/*.test.js' 2>&1 | tail -8
echo

# ─── Step 2: verify the offline verifier still runs ──────
echo "→ Step 2/6: shadow-verify against the archived dogfood bundle"
node bin/shadow-verify.mjs \
  docs/dogfood-evidence/m2.1-first-success-13df92c7-2026-07-13.json \
  --public-key docs/dogfood-evidence/public-key-2026-07-13.pem \
  || { echo "✗ verify failed — DO NOT DEMO"; exit 1; }
echo

# ─── Step 3: start local server for the M5 replay ────────
echo "→ Step 3/6: starting local server for demos/replay/"
PORT="${PORT:-8765}"
if lsof -i ":$PORT" >/dev/null 2>&1; then
  echo "  port $PORT already in use; assuming server is up"
else
  (cd demos/replay && python3 -m http.server "$PORT" > /tmp/xreal-demo-http.log 2>&1 &)
  sleep 1
fi
echo "  server: http://localhost:$PORT/index.html"
echo

# ─── Step 4: open the demo in the default browser ────────
echo "→ Step 4/6: opening M5 replay in default browser (xreal=1 mode)"
# `?xreal=1` activates the in-glasses legibility overrides in styles.css:
# bigger fonts, higher contrast, motion capped for 33 PPD birdbath optics.
# For persistent 125% device zoom without Cmd-+, use:
#   open -na "Google Chrome" --args --force-device-scale-factor=1.25 \
#     "http://localhost:$PORT/index.html?xreal=1"
open "http://localhost:$PORT/index.html?xreal=1"
sleep 1
echo

# ─── Step 5: XREAL One Pro connection checklist ──────────
echo "→ Step 5/6: XREAL One Pro connection (manual)"
cat <<'EOF'
  1. Plug XREAL One Pro USB-C cable into ANY Mac USB-C port.
     (Confirmed 2026-07-13: no adapter needed on M1-M4, DP-Alt Mode auto.)
     (There is NO XREAL software to install on macOS. Nebula for Mac was
     discontinued. All display config is native macOS + on-glass buttons.)
  2. macOS should recognize the glasses as a standard external 1920×1080
     display, 120 Hz.
  3. Confirm mirror-mode: System Settings → Displays → click the XREAL
     display → "Use as:" → Mirror Built-in Display.
  4. Force 60 Hz to avoid stereo-mismatch double-vision:
     System Settings → Displays → Refresh Rate → 60 Hz.
  5. Wear the glasses. The M5 replay tab should be a 171" virtual window.
  6. Legibility fixes (in priority order):
     a. The ?xreal=1 URL param already bumps fonts + contrast — verified.
     b. Cmd-+ two extra times gets you to comfortable reading zoom
        (birdbath optics deliver ~33 PPD, not 90 as some sources claim).
     c. Electrochromic auto-dim can darken in bright rooms; hold the
        right-temple Quick Button to override.
     d. WebXR immersive-ar does NOT work on macOS Chrome (confirmed
        2026-07-13). Your demo renders as a flat browser window in-lens,
        which is what you want for a Tamper-button demo anyway.
  7. XREAL Eye ($99 add-on) NOT required for this demo. It unlocks
     cameras + 6DoF anchoring for spatial capture, not text legibility.
EOF
echo

# ─── Step 6: rehearsal cue card ──────────────────────────
echo "→ Step 6/6: rehearsal cue card"
cat <<'EOF'
  In the M5 replay tab:
  - Drop demos/replay/data/demo-session.bundle.json into the drop zone
    (or click "choose a file")
  - Paste the contents of demos/replay/data/demo-public-key.pem into
    the "Public key" collapsible textarea
  - Confirm: header badges show sid + 69 events + agent + model
  - Confirm: verdict is green: "signature valid · SELF_SIGNED"
  - Click any event; inspector renders payload_hash + prev_hash
  - Click "Tamper & verify":
    * Row #0 flashes red
    * Rows #1..#68 dim with ⛓✗ chain-break markers
    * Verdict flips red: "verify failed: prev_hash_mismatch"
    * Caption prints seq / reason / impact
  - Click "Reset"; back to green pristine state

  IF ANY OF THE ABOVE DOES NOT HAPPEN, DO NOT DEMO LIVE.
  Fallback: show the archived bundle via bin/shadow-verify.mjs on the
  laptop screen. Same content, no glasses.
EOF
echo
echo "─── Smoke test scaffolding complete. ──────────────────"
echo "Server PID logged to /tmp/xreal-demo-http.log."
echo "Kill it with: pkill -f 'python3 -m http.server $PORT'"
