#!/usr/bin/env bash
# Launches the XREAL V10 core candidate and captures 90s of logcat filtered to Unity/XREAL/ShadowLens.
source "$(dirname "$0")/_adb.sh"; require_device
PKG="${1:-com.shadowlens.xrealvoice}"
OUT="device-v10-logcat-$("$ADB" shell getprop ro.product.model | tr -d '\r ').txt"
"$ADB" logcat -c
"$ADB" shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1
echo "capturing 90s logcat to $OUT (loader/tracking/TTS states)..."
timeout 90 "$ADB" logcat Unity:V XREAL:V NRSDK:V ShadowLens:V AndroidRuntime:E "*:S" | tee "$OUT" || true
echo "grep the log for: XREALXRLoader, OnXRLoaderStart, GetTrackingType, loader phase"
