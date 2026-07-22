#!/usr/bin/env bash
# Capture ACTUAL device audio output through an approved route (screenrecord audio or an external
# recorder). This ONLY runs with a device; it never fabricates samples. Output goes to
# media/voice-v8/device/ and MUST record engine/voice/locale/route metadata (see manifest template).
source "$(dirname "$0")/_adb.sh"; require_device
echo "Device connected. Use the in-app VOICE ENVIRONMENT panel to read the real engine/voice, then"
echo "record each script id via an approved capture route. Do NOT relabel macOS 'say' fixtures as device audio."
"$ADB" shell dumpsys tts 2>/dev/null | head -40 || echo "(dumpsys tts unavailable)"
