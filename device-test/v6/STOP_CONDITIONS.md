# Device STOP conditions (v6)

Stop + fall back when: 3 repeated crashes · loader never starts after clean reinstall · permission loop
persists · controller cannot select reliably · Reset fails · app cannot exit · severe judder persists ·
text unreadable · tracking repeatedly drops · thermally uncomfortable · camera stays black · camera crashes
the app · OCR blocks the main thread · battery too low · debugging threatens the planned demo/window.

Stopping ONE capability does not end all testing:
- Camera fails → continue 3DoF/6DoF + guided-story testing.
- 6DoF fails → continue 3DoF session-relative workspace.
- XREAL candidate fails → return to base guided-story candidate.
- Base candidate fails → return to stable APK / browser / recorded video.
