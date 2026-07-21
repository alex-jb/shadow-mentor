#!/usr/bin/env bash
# Exports the device log for the Shadow Lens app to a timestamped file (material lines only:
# the [ShadowLens]/[spatial-agent] tags + crashes). Run after a session on the device.
set -euo pipefail
command -v adb >/dev/null || { echo "adb not on PATH"; exit 1; }
HERE="$(cd "$(dirname "$0")" && pwd)"; OUT="$HERE/logs"; mkdir -p "$OUT"
F="$OUT/shadow-lens-$(date -u +%Y%m%dT%H%M%SZ).log"
adb logcat -d | grep -E "ShadowLens|spatial-agent|Unity|AndroidRuntime|FATAL" > "$F" || true
echo "log → $F ($(wc -l < "$F" | tr -d ' ') lines)"
