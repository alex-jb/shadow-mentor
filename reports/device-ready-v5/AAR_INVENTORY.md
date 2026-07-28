# Guided Story Android Candidate — native library / AAR inventory

APK RELEASE build. `unzip -l` on the candidate. Accessed 2026-07-21.

## Native libraries (all `lib/arm64-v8a/`, ARM64-only)

| Library | Origin | Notes |
|---|---|---|
| `libil2cpp.so` | Unity IL2CPP | **confirms IL2CPP backend** — all app C# is AOT-compiled here |
| `libunity.so` | Unity engine | core engine |
| `libmain.so` | Unity | native entry |
| `libgame.so` | Unity GameActivity | GameActivity player variant |
| `libc++_shared.so` | NDK | shared C++ runtime |
| `libswappywrapper.so` | Unity / AGDK Swappy | Android frame pacing |

No third-party or XREAL native libraries are present — the base candidate does **not** bundle the
XREAL SDK (that is a separate, gated build behind `SHADOW_XREAL_SDK`). No duplicate ABIs
(armeabi-v7a / x86 / x86_64 absent).

## Duplicate classes / dependency risk

The base candidate has no non-Unity AARs, so no cross-AAR duplicate-class risk. When the XREAL SDK
candidate is built, re-run this inventory to check for duplicate classes between the XREAL AAR and any
other plugin.

## Story data

The three guided-story semantic snapshots are bundled as Unity `TextAsset`s (serialized into the
scene/asset data, not as loose `.json` files under `assets/`). They are the byte-identical
cross-engine parity anchors (see `SHADOW_CROSS_ENGINE_PARITY.md`).
