# V11 — branch ancestry (verified)

Computed via `git merge-base` per phase branch vs `feat/shadow-xreal-device-validation-v10`. 2026-07-22.

## Finding: V10 is a single linear chain — NOT six independent unmerged branches
Every phase branch is a **linear ancestor of V10** (merge-base == branch HEAD → fully contained). No
completed work is absent from V10.

```
Step 4  shared-story-adapters  92e3416  ─┐  (all linear, first-parent)
V5      device-ready-v5        f11b34b   │
V6      xreal-native-v6        851bb4b   ├─►  V8  xreal-voice-device-v8  eefc2ff
V7      voice-ux-v7            ec65721   │        (V9 real-SDK work continued on the v8 branch)
                                         │
                                         └─►  V10 xreal-device-validation-v10  085ac36 → ada7de2
                                                     │
                                                     └─►  V11 spatial-ux-asset-audit-v11 (this branch)
```

| Phase branch | HEAD | Contained in V10? |
|---|---|---|
| feat/shadow-shared-story-adapters | 92e3416 | ✅ linear ancestor |
| feat/shadow-device-ready-v5 | f11b34b | ✅ linear ancestor |
| feat/shadow-xreal-native-v6 | 851bb4b | ✅ linear ancestor |
| feat/shadow-voice-ux-v7 | ec65721 | ✅ linear ancestor |
| feat/shadow-xreal-voice-device-v8 | eefc2ff | ✅ linear ancestor |
| feat/shadow-xreal-device-validation-v10 | 085ac36 → ada7de2 | (base) |

**Research branches deliberately excluded from V11:** `research/shadow-trendshift-evaluation` and
`research/shadow-img2threejs-prop-spike` (the img2threejs spike is research-only, KEEP-AS-RESEARCH, not
merged into any product branch).

## Baseline at V11 start
- V11 base commit: `ada7de2` (= V10 HEAD).
- Node: **1,940 total · 1,937 passed · 3 skipped · 0 failed**.
- Stable fallback APK unchanged: `93f2a81aa5f965aec540526abe621b152c7507c03c0fea51d381094bd548d0b8`.
- Local candidate APKs (gitignored): guided-story-v5, voice-v7, voice-v8-base, xreal-voice-v8 (135 MB),
  xreal-voice-v10-core (128 MB). None will be overwritten in V11.
