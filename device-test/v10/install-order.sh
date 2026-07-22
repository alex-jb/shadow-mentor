#!/usr/bin/env bash
# Installs the three candidates in the SAFE order (stable → base voice → XREAL core). Separate package
# IDs, so the stable fallback is never overwritten. Requires a connected authorized device.
source "$(dirname "$0")/_adb.sh"; require_device
B=../../apps/shadow-lens/unity/Build/Android
STABLE=../../../shadow-mentor/apps/shadow-lens/demo/wednesday/frozen/mock-stable-5168b07.apk
echo "== A: stable fallback (com.shadowlens... frozen) =="; [ -f "$STABLE" ] && { shasum -a 256 "$STABLE"; "$ADB" install -r "$STABLE"; } || echo "stable APK not found: $STABLE"
echo "== B: base voice (com.shadowlens.voice.base) =="; "$ADB" install -r "$B/shadow-lens-voice-v8-base.apk"
echo "== C: XREAL core V10 (com.shadowlens.xrealvoice) — collect logcat immediately after launch =="; "$ADB" install -r "$B/shadow-lens-xreal-voice-v10-core.apk"
echo "installed. Launch + logcat: device-test/v10/launch-and-logcat.sh"
