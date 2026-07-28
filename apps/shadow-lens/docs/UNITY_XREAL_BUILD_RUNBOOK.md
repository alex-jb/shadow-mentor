# Unity / XREAL build runbook

Exact steps to build + install the Shadow Lens Unity app on One Pro + Eye. NONE executed
on the build host (no Unity/Android SDK) — DEVICE-VALIDATION-PENDING.

## Versions (pin on the build host)
- Unity **6000.0 LTS** (or 2022.3 LTS) · XREAL SDK **3.1.0** (`com.xreal.xr.tar.gz`)
- XR Interaction Toolkit **3.0.x** + Starter Assets · Input System 1.7 · Test Framework 1.4

## Build
1. Open `apps/shadow-lens/unity/` in Unity Hub (folder hierarchy + Packages/manifest.json + ProjectSettings are committed).
2. Package Manager → Add package from tarball → `com.xreal.xr.tar.gz` (from developer.xreal.com/download). Import samples: Interaction Basics + Camera Features (RGBCamera).
3. Project Settings → XR Plug-in Management → Android → enable **XREAL** → Project Validation → **Fix All**.
4. Player Settings: **IL2CPP · ARM64 · OpenGLES3 · ASTC · new Input System**; package name; **CAMERA + RECORD_AUDIO** permissions; "Allow display over other apps".
5. Drop the built AARs (`AndroidBridges/ocr-aar`, voice-aar) into `Assets/Plugins/Android/`.
6. File → Build Settings → Android → Build APK.

## Install + run
- `adb install -r ShadowLens.apk` · connect Eye + One Pro (USB-C DP-Alt) to the phone.
- Launch via **ControlGlasses** (generic phone) or **MyGlasses** (Beam Pro). Grant camera + mic.
- Update glasses firmware first (MyGlasses ≥1.11 / ControlGlasses) — required for 6DoF.
- Tested hosts: **Beam Pro / Samsung S25**. S24 Ultra unverified.
- `adb logcat -s ShadowLens Unity XREAL` for diagnostics.

## Validate (each is a DEVICE-VALIDATED gate)
capability screen honest → Eye preview visible → touchpad freezes a frame → SHA-256 shown
→ 6DoF panel stays in-session → ML Kit boxes → source-bound analysis → real bundle seals
+ verifies → tamper → exact failed_seq → reset. See DEVICE_ACCEPTANCE_CHECKLIST.md.
