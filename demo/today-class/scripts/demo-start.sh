#!/usr/bin/env bash
# Start the classroom demo — a local static server over the repo, offline. Deterministic port.
# The demo also works from file:// by double-click; the server just avoids any browser file:// quirks.
set -euo pipefail
PORT=8137
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PIDFILE="$REPO/demo/today-class/scripts/.demo-server.pid"

if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "⚠️  port $PORT already in use — run demo-stop.sh first (or a server is already up)."; exit 1
fi

cd "$REPO"
# Python stdlib server, no external deps, binds localhost only, no network egress.
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
echo $! > "$PIDFILE"
sleep 1

BASE="http://127.0.0.1:$PORT"
cat <<EOF

  ✅ Shadow classroom demo server up (offline · localhost only · pid $(cat "$PIDFILE"))

  OPEN THESE (in your browser, fullscreen on the presentation display):

  1. OPENER (banking narrative, EN/中文):
     $BASE/demos/guided-shadow-demo.html

  2. CORE PROOF + INDEPENDENT VERIFIER (the heart of the demo):
     $BASE/verify.html
       · load  demo/today-class/fixtures/pristine-banking-bundle.json   → VERIFIED
       · load  demo/today-class/fixtures/tampered-banking-bundle.json    → FAILED (first failure + downstream)
       · paste demo/today-class/fixtures/reference-2026-public-key.pem   if prompted for a public key

  3. OPTIONAL spatial view (Audit Room, offline, keyboard-driven):
     $BASE/demos/replay/3d/index.html      (beats 1–8, T tamper, R reset, 0 reset)

  file:// fallback (no server): just double-click verify.html / demos/guided-shadow-demo.html

  Stop with:  demo/today-class/scripts/demo-stop.sh
EOF
