#!/usr/bin/env bash
# Shared: locate the adb that ships with the Unity Android SDK (do not assume a system adb).
set -euo pipefail
find_adb() {
  for c in \
    "/Applications/Unity/Hub/Editor/6000.0.23f1/PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb" \
    "${ANDROID_SDK_ROOT:-}/platform-tools/adb" \
    "$(command -v adb 2>/dev/null || true)"; do
    [ -n "$c" ] && [ -x "$c" ] && { echo "$c"; return 0; }
  done
  echo "ERROR: adb not found (install Unity Android SDK or set ANDROID_SDK_ROOT)" >&2; return 1
}
ADB="$(find_adb)"
have_device() { "$ADB" get-state >/dev/null 2>&1; }
require_device() { have_device || { echo "No device connected (adb get-state failed). Aborting — this package never assumes a device." >&2; exit 2; }; }
