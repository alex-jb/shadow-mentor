#!/usr/bin/env bash
source "$(dirname "$0")/_adb.sh"; require_device
"$ADB" logcat -c; timeout 60 "$ADB" logcat "*:V" | tee android-system-logcat.txt || true
