#!/usr/bin/env bash
# Installs a (frozen) APK onto the connected Beam Pro / Android device via adb.
#   bash demo/wednesday/install-apk.sh <path-to.apk>
set -euo pipefail
APK="${1:?usage: install-apk.sh <apk>}"
command -v adb >/dev/null || { echo "adb not on PATH — add <Unity>/PlaybackEngines/AndroidPlayer/SDK/platform-tools"; exit 1; }
DEVS=$(adb devices | awk 'NR>1 && $2=="device"{print $1}')
[ -n "$DEVS" ] || { echo "no device — connect the Beam Pro (USB) + enable USB debugging"; exit 1; }
echo "devices: $DEVS"
adb install -r "$APK"
echo "installed. Package: com.shadowlens.lens — launch it on the device."
