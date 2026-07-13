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
echo "→ Step 4/6: opening M5 replay in default browser"
open "http://localhost:$PORT/index.html"
sleep 1
echo

# ─── Step 5: XREAL One Pro connection checklist ──────────
echo "→ Step 5/6: XREAL One Pro connection (manual)"
cat <<'EOF'
  1. Plug XREAL One Pro USB-C cable into the Mac.
  2. macOS should recognize the glasses as an external display.
  3. Confirm mirror-mode is on (System Settings → Displays → Arrangement →
     "Mirror Displays" checkbox ON).
  4. Wear the glasses. The M5 replay tab should be visible in-lens.
  5. If text is not legible at reading distance:
     - Cmd-+ two or three times to zoom in the browser
     - The XREAL default is ~90 PPD; adjust Mac display scaling under
       System Settings → Displays → Larger Text if needed
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
