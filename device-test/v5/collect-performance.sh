#!/usr/bin/env bash
# Pulls dumpsys gfxinfo (frame timing) + meminfo for the candidate. On-device numbers only.
source "$(dirname "$0")/_adb.sh"; require_device
PKG=com.shadowlens.guidedstory
"$ADB" shell dumpsys gfxinfo "$PKG" framestats > gfxinfo-$PKG.txt 2>/dev/null || true
"$ADB" shell dumpsys meminfo "$PKG" > meminfo-$PKG.txt 2>/dev/null || true
echo "wrote gfxinfo-$PKG.txt + meminfo-$PKG.txt (device-measured, not Editor)"
