#!/usr/bin/env bash
# Stop ONLY the server started by demo-start.sh (never touches other node/browser/Unity processes).
set -euo pipefail
PIDFILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.demo-server.pid"
if [ -f "$PIDFILE" ]; then
  PID="$(cat "$PIDFILE")"
  if kill -0 "$PID" 2>/dev/null; then kill "$PID" && echo "stopped demo server (pid $PID)"; else echo "server pid $PID not running"; fi
  rm -f "$PIDFILE"
else
  echo "no demo server pidfile — nothing to stop (or it was started elsewhere)."
fi
