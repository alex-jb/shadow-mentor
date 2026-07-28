#!/usr/bin/env bash
source "$(dirname "$0")/_adb.sh"; require_device
APK="${1:-../../apps/shadow-lens/unity/Build/Android/shadow-lens-guided-story-v5-candidate.apk}"
[ -f "$APK" ] || { echo "APK not found: $APK (build via Shadow Lens > Build Guided Story Android Candidate)"; exit 1; }
echo "installing $APK"; "$ADB" install -r "$APK"
