#!/usr/bin/env bash
source "$(dirname "$0")/_adb.sh"; require_device
OUT="logcat-$("$ADB" shell getprop ro.product.model | tr -d '\r ' ).txt"
echo "clearing + capturing 60s of logcat to $OUT"; "$ADB" logcat -c
timeout 60 "$ADB" logcat Unity:V ShadowLens:V AndroidRuntime:E "*:S" | tee "$OUT" || true
