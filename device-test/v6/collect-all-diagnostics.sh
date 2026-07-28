#!/usr/bin/env bash
d="$(dirname "$0")"; bash "$d/collect-logcat.sh"; bash "$d/collect-xreal-logs.sh"; bash "$d/collect-shadow-report.sh"
source "$d/_adb.sh"; require_device
"$ADB" shell dumpsys gfxinfo com.shadowlens.xreal framestats > gfxinfo.txt 2>/dev/null || true
"$ADB" shell dumpsys meminfo com.shadowlens.xreal > meminfo.txt 2>/dev/null || true
echo "collected: android-system-logcat / xreal-sdk-logcat / shadow-structured-events / gfxinfo / meminfo (3 log domains kept separate)"
