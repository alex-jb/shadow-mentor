# First 60 minutes on device

1. (0-10m) `collect-device-info.sh`; confirm MyGlasses/firmware per official prereqs.
2. (10-20m) `install-guided-story.sh`; `launch.sh`; confirm Banking READY + ANDROID MOCK banner.
3. (20-35m) Walk the 3 guided stories; toggle 2D audit, language, reduced motion; test Reset/Recenter.
4. (35-45m) `reset-app-data.sh` → relaunch; confirm recovery to safe state.
5. (45-55m) `collect-logcat.sh` + `collect-performance.sh`; save outputs next to RESULT_TEMPLATE.md.
6. (55-60m) Fill RESULT_TEMPLATE.md. If any STOP condition hit, switch to the fallback and note it.

Time-box hard: if debugging threatens a scheduled demo, stop and use the stable mock / browser demo.
