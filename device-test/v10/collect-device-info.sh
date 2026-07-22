#!/usr/bin/env bash
source "$(dirname "$0")/_adb.sh"; require_device
echo "model:"; "$ADB" shell getprop ro.product.model
echo "android:"; "$ADB" shell getprop ro.build.version.release
echo "abi:"; "$ADB" shell getprop ro.product.cpu.abi
echo "battery:"; "$ADB" shell dumpsys battery | grep -iE "level|status" | head -2
echo "storage (free):"; "$ADB" shell df /data | tail -1
echo "xreal/myglasses packages:"; "$ADB" shell pm list packages | grep -iE "xreal|nreal|myglass" || echo "(none)"
echo "TTS engines:"; "$ADB" shell pm list packages | grep -iE "tts|texttospeech" || echo "(none)"
