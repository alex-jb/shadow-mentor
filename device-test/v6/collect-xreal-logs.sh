#!/usr/bin/env bash
# SDK 3.1 auto-Logcat writes to the app's files dir; also filter XREAL tags. Kept SEPARATE from Shadow events.
source "$(dirname "$0")/_adb.sh"; require_device
PKG=com.shadowlens.xreal
"$ADB" logcat -d -s XREAL NRSDK Unity > xreal-sdk-logcat.txt 2>/dev/null || true
"$ADB" shell "run-as $PKG ls files/ 2>/dev/null" || echo "(auto-logcat file path filled after SDK import)"
echo "wrote xreal-sdk-logcat.txt"
