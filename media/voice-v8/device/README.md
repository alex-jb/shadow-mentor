# media/voice-v8/device/ — device audio (currently empty)

This directory holds REAL Beam Pro / Android device audio captures. It is empty until a device day is
run (`device-test/v8/capture-device-audio.sh`). The macOS `say` fixture samples live separately in
`media/voice-v7/` and are labelled desktop fixtures — they are NEVER relabelled as device audio.
Each device sample must record: device · engine · voice · locale · app commit · APK hash · XREAL state
· date · output route · script id (en-ready/en-tamper/en-quote/en-limitation/en-persona-disagreement /
zh-* / tracking-lost / camera-unavailable).
