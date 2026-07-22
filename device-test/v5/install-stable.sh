#!/usr/bin/env bash
# Installs the STABLE mock fallback APK (never overwritten by this package).
source "$(dirname "$0")/_adb.sh"; require_device
APK="${1:-../../../shadow-mentor/apps/shadow-lens/demo/wednesday/frozen/mock-stable-5168b07.apk}"
[ -f "$APK" ] || { echo "stable APK not found: $APK"; exit 1; }
echo "stable sha256:"; shasum -a 256 "$APK"
"$ADB" install -r "$APK"
