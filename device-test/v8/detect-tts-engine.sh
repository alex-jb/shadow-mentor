#!/usr/bin/env bash
# Reports the actual Android TTS environment (engine packages + default). No assumption that Google
# Speech Services is installed; no silent voice download.
source "$(dirname "$0")/_adb.sh"; require_device
echo "== TTS engines installed =="; "$ADB" shell pm list packages | grep -iE "tts|texttospeech|speech" || echo "(none obvious — read VOICE ENVIRONMENT panel in-app)"
echo "== default TTS settings =="; "$ADB" shell settings get secure tts_default_synth 2>/dev/null; "$ADB" shell settings get secure tts_default_rate 2>/dev/null
