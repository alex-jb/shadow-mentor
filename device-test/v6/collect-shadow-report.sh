#!/usr/bin/env bash
# Pulls Shadow's own STRUCTURED diagnostics (evidence-free) — separate from SDK/system logcat.
source "$(dirname "$0")/_adb.sh"; require_device
PKG="${1:-com.shadowlens.guidedstory}"
"$ADB" shell "run-as $PKG cat files/shadow-diagnostics.json 2>/dev/null" > shadow-structured-events.json || echo "(diagnostics export path filled when the app writes it on device)"
echo "wrote shadow-structured-events.json (redact before sharing: node redact-diagnostics.mjs)"
