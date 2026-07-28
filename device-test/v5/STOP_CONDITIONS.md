# Device test — STOP conditions

Stop the on-device session and fall back if ANY of these occur. Record which one in RESULT_TEMPLATE.md.

- Repeated crash (≥2 in a session)
- Tracking never initializes (loader starts but no tracking type after ~30s)
- Severe unreadability (labels illegible at comfortable head distance)
- Input cannot select (no reliable Select on the 3DoF controller / touch)
- Reset fails (cannot return to Banking READY)
- Thermal throttling (device hot, sustained frame drops)
- Persistent judder (motion-to-photon clearly uncomfortable)
- Camera black frames (Eye path returns only black — do NOT claim capture)
- Permission loop (an OS permission dialog re-appears and blocks progress)
- App cannot exit cleanly (glasses-exit does not return to host)
- Debugging would threaten a scheduled demo (time-box: stop and use a fallback)

## Fallbacks (in order)
1. Stable Android mock APK (`install-stable.sh`) — the frozen fallback (never overwritten).
2. Browser guided demo (`prototypes/shadow-3d-v2/story-player.html`).
3. Recorded video (`media/story-adapters/threejs/*.mp4`).
4. Screenshots (`media/story-adapters/*`).
